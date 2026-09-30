"""
engine.py
This is the "brain" of the platform. Given a plain-English prompt, it:
  1. Uses Tavily to discover relevant, permitted URLs on the web.
  2. Uses an LLM (Gemini) to decide WHAT fields matter for this request
     (the "dynamic schema" step).
  3. Uses Crawl4AI to fetch each URL and turn it into clean Markdown text.
  4. Uses the LLM again, this time with Gemini's structured output mode
     (response_schema), to pull out an array of records that matches the
     schema from step 2. This constrains the model to return valid JSON
     matching our schema -- no hallucinated formatting, no crashes parsing
     broken JSON.
  5. Deduplicates records by hashing their content.
  6. Saves everything into Supabase, updating the workflow's status at every
     stage so the frontend can show live progress.

Design choice: we use asyncio.create_task() instead of Celery. Celery needs a
separate message broker (Redis) running as its own service -- one more thing
to deploy and one more thing that can silently fail during a live demo.
asyncio gives the same "don't block the API response" behavior with zero
extra infrastructure, which matters a lot when you only have a few days and
one shot at a live judging round.

LLM provider: Gemini (google-genai SDK), using gemini-3.1-flash-lite --
GA-stable as of May 2026, no scheduled shutdown, and available on Google
AI Studio's free tier. Swapped in after the previous OpenAI integration
ran out of billing credits.
"""
import os
import json
import hashlib
import traceback
from datetime import datetime, timezone

from dotenv import load_dotenv
from google import genai
from google.genai import types
from tavily import TavilyClient
from crawl4ai import AsyncWebCrawler

from database import supabase

load_dotenv()

gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

MODEL = "gemini-3.1-flash-lite"


def update_status(workflow_id: str, status: str, extra: dict | None = None):
    """Small helper so every stage of the pipeline can update the UI's progress bar."""
    data = {"status": status}
    if extra:
        data.update(extra)
    supabase.table("workflows").update(data).eq("id", workflow_id).execute()


def discover_urls(prompt: str, max_results: int = 4) -> list[str]:
    """Step 1: Ask Tavily for relevant, publicly permitted URLs for this request."""
    response = tavily_client.search(query=prompt, max_results=max_results, search_depth="basic")
    urls = [r["url"] for r in response.get("results", [])]
    return urls


def generate_schema(prompt: str) -> dict:
    """
    Step 2: Ask the LLM to decide which fields are needed for this request.
    Returns something like:
      {"fields": [{"name": "company_name", "description": "Name of the company"},
                  {"name": "email", "description": "Contact email if present"}]}
    """
    system = (
        "You design data extraction schemas. Given a user's plain-English data "
        "request, output ONLY a JSON object with a 'fields' array. Each field has "
        "a 'name' (snake_case, short) and a 'description'. Pick 3 to 6 fields that "
        "best capture what the user is asking for. Always include a field for any "
        "name/title-like value if relevant. Do not include a 'source_url' field -- "
        "that is tracked separately by the system."
    )
    try:
        response = gemini_client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                temperature=0,
            ),
        )
        schema = json.loads(response.text)
    except Exception as e:
        print(f"[engine] generate_schema failed, using fallback: {e}")
        schema = {}

    if "fields" not in schema or not schema["fields"]:
        schema = {"fields": [{"name": "title", "description": "Main title or name found"},
                              {"name": "summary", "description": "Short summary of relevant content"}]}
    return schema


def build_json_schema_for_extraction(fields: list[dict]) -> dict:
    """Turns our dynamic field list into a Gemini-compatible response schema.

    Gemini's structured output schema is a constrained subset of OpenAPI:
    types are uppercase strings (OBJECT/ARRAY/STRING) and it does not
    support 'additionalProperties'.
    """
    properties = {f["name"]: {"type": "STRING"} for f in fields}
    record_schema = {
        "type": "OBJECT",
        "properties": properties,
        "required": list(properties.keys()),
    }
    return {
        "type": "OBJECT",
        "properties": {
            "records": {
                "type": "ARRAY",
                "items": record_schema,
            }
        },
        "required": ["records"],
    }


async def crawl_url_to_markdown(url: str) -> str:
    """Step 3: Use Crawl4AI to fetch a page and convert it to clean, LLM-ready Markdown."""
    async with AsyncWebCrawler(verbose=False) as crawler:
        result = await crawler.arun(url=url)
        return result.markdown or ""


def extract_records_from_markdown(markdown: str, fields: list[dict]) -> list[dict]:
    """
    Step 4: Structured extraction. We pass the schema built from step 2 as a
    Gemini response_schema, so the model is constrained to the shape we
    need. If nothing relevant is found, it should return an empty array
    instead of hallucinating fake data.
    """
    if not markdown.strip():
        return []

    field_list_desc = "\n".join(f"- {f['name']}: {f['description']}" for f in fields)
    json_schema = build_json_schema_for_extraction(fields)

    system = (
        "Extract every relevant record from the page content below that matches "
        "the requested fields. If a field's value truly is not present for a "
        "record, use an empty string. If there is nothing relevant on the page, "
        "return an empty 'records' array. Do not invent data that is not present."
        f"\n\nFields to extract:\n{field_list_desc}"
    )

    try:
        response = gemini_client.models.generate_content(
            model=MODEL,
            contents=markdown[:12000],
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                response_schema=json_schema,
                temperature=0,
            ),
        )
        result = json.loads(response.text)
    except Exception as e:
        print(f"[engine] extract_records_from_markdown failed: {e}")
        return []

    return result.get("records", [])


def dedupe(records: list[dict]) -> list[dict]:
    """Step 5: Remove exact-duplicate records using a content hash."""
    seen = set()
    unique = []
    for r in records:
        key = hashlib.sha256(json.dumps(r, sort_keys=True).encode()).hexdigest()
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return unique


async def run_data_workflow(workflow_id: str, prompt: str):
    """
    The full pipeline, run in the background so the API can respond instantly
    with a workflow_id while this keeps working.
    """
    try:
        update_status(workflow_id, "searching")
        urls = discover_urls(prompt)
        if not urls:
            update_status(workflow_id, "failed", {"error_message": "No sources found for this prompt."})
            return

        schema = generate_schema(prompt)
        supabase.table("workflows").update(
            {"schema_definition": schema}
        ).eq("id", workflow_id).execute()

        update_status(workflow_id, "crawling")
        all_records = []
        for url in urls:
            try:
                markdown = await crawl_url_to_markdown(url)
                update_status(workflow_id, "extracting")
                records = extract_records_from_markdown(markdown, schema["fields"])
                for r in records:
                    all_records.append({"source_url": url, "payload": r})
            except Exception as page_error:
                print(f"[engine] Skipping {url}: {page_error}")
                continue

        payload_only = [r["payload"] for r in all_records]
        unique_payloads = dedupe(payload_only)
        unique_records = []
        used = set()
        for r in all_records:
            key = hashlib.sha256(json.dumps(r["payload"], sort_keys=True).encode()).hexdigest()
            if key in used:
                continue
            if r["payload"] in unique_payloads:
                unique_records.append(r)
                used.add(key)

        if unique_records:
            rows = [
                {
                    "workflow_id": workflow_id,
                    "source_url": r["source_url"],
                    "payload": r["payload"],
                }
                for r in unique_records
            ]
            supabase.table("extracted_data").insert(rows).execute()

        update_status(workflow_id, "completed")

    except Exception:
        traceback.print_exc()
        update_status(workflow_id, "failed", {"error_message": "Internal error during extraction."})