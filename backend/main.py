"""
main.py
FastAPI entrypoint. Exposes the 3 endpoints the frontend needs:
  POST /api/workflows/start
  GET  /api/workflows/{workflow_id}/status
  GET  /api/workflows/{workflow_id}/results
  GET  /api/workflows            (list, for the sidebar history)

Also implements the "Cache & Win" demo safety net: a small hardcoded map of
prompt -> workflow_id. If a judge (or you) types an EXACT prompt you already
ran successfully before the demo, the API returns that finished workflow
instantly instead of re-running a live crawl. This removes all risk of a
live network failure during judging. See the README for how to set this up
the night before you present.
"""
import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
import os
import asyncio
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import supabase
from engine import run_data_workflow

load_dotenv()

app = FastAPI(title="AI Data Intelligence Platform")

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEMO_CACHE: dict[str, str] = {
}


class StartRequest(BaseModel):
    prompt: str


@app.get("/")
def health():
    return {"status": "ok", "service": "ai-data-intelligence-platform"}


@app.post("/api/workflows/start")
async def start_workflow(body: StartRequest):
    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    cache_key = prompt.lower().strip()
    if cache_key in DEMO_CACHE:
        return {"workflow_id": DEMO_CACHE[cache_key], "cached": True}

    result = (
        supabase.table("workflows")
        .insert({"prompt_text": prompt, "status": "pending"})
        .execute()
    )
    workflow_id = result.data[0]["id"]

    asyncio.create_task(run_data_workflow(workflow_id, prompt))

    return {"workflow_id": workflow_id, "cached": False}


@app.get("/api/workflows")
def list_workflows():
    result = (
        supabase.table("workflows")
        .select("id, prompt_text, status, created_at")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return result.data


@app.get("/api/workflows/{workflow_id}/status")
def get_status(workflow_id: str):
    result = supabase.table("workflows").select("*").eq("id", workflow_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Workflow not found.")
    return result.data[0]


@app.get("/api/workflows/{workflow_id}/results")
def get_results(workflow_id: str):
    result = (
        supabase.table("extracted_data")
        .select("*")
        .eq("workflow_id", workflow_id)
        .execute()
    )
    return result.data
