# AI Data Intelligence Platform

An AI-powered research workspace that turns a plain-English request into a structured, source-linked dataset.

For example, enter `Find recent AI startup funding news`. The platform discovers relevant web pages, determines which fields matter, reads the pages, extracts records, removes exact duplicates, and presents the results in a searchable dashboard.

## Features

- **Natural-language data requests**: describe the information you need without writing scraper code.
- **Dynamic extraction schemas**: Gemini selects the most useful fields for each request.
- **Multi-source discovery**: Tavily finds relevant public web pages for the prompt.
- **Browser-based crawling**: Crawl4AI and Playwright convert pages into clean content for extraction.
- **Structured AI extraction**: results are returned as constrained JSON records rather than unstructured text.
- **Source traceability**: every result keeps the URL it came from.
- **Duplicate removal**: identical extracted payloads are deduplicated before saving.
- **Live workflow progress**: the dashboard shows searching, crawling, extracting, and completed states.
- **Result exploration**: filter by text or source, sort columns, and inspect dynamic fields.
- **CSV export**: download the visible result set for use in spreadsheets or downstream systems.
- **Workflow history**: completed and in-progress workflows are stored in Supabase for later access.
- **Demo cache**: optionally replay a previously completed workflow instantly for reliable demonstrations.

## How It Works

1. The frontend sends the user's prompt to the FastAPI backend.
2. Tavily discovers up to four relevant URLs.
3. Gemini creates a request-specific extraction schema.
4. Crawl4AI fetches each page and converts it to Markdown.
5. Gemini extracts records using the generated structured schema.
6. The backend deduplicates records and stores them in Supabase with their source URLs.
7. The frontend polls workflow status and renders the resulting dynamic table.

## Project Structure

```text
ai-data-platform/
├── backend/
│   ├── main.py              # FastAPI routes and workflow orchestration
│   ├── engine.py            # Search, schema generation, crawling, extraction, dedupe
│   ├── database.py          # Supabase client
│   ├── requirements.txt
│   ├── .env.example
│   ├── Dockerfile
│   └── supabase_schema.sql
├── frontend-app/            # Complete, runnable Next.js frontend
│   ├── app/
│   ├── components/
│   ├── lib/api.ts
│   └── package.json
└── frontend/                # Earlier frontend component set retained for reference
```

## Requirements

- Python 3.11 or newer
- Node.js 18 or newer
- A Supabase project
- A Google AI Studio Gemini API key
- A Tavily API key
- Playwright's Chromium browser dependency

## Configure Supabase

1. Create a project at [supabase.com](https://supabase.com/).
2. Open **SQL Editor**, create a query, and run [`backend/supabase_schema.sql`](backend/supabase_schema.sql).
3. Open **Project Settings > API** and copy the project URL and API key.

The schema creates:

- `workflows`: prompt, status, generated schema, errors, and timestamps.
- `extracted_data`: extracted payloads linked to a workflow and source URL.

## Run the Backend

From the repository root:

```bash
cd backend
python -m venv .venv
```

Activate the environment:

```bash
# Windows PowerShell
.venv\Scripts\Activate.ps1

# macOS/Linux
source .venv/bin/activate
```

Install dependencies and the browser runtime:

```bash
pip install -r requirements.txt
python -m playwright install --with-deps chromium
```

Create `backend/.env` and set:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key
GEMINI_API_KEY=your-gemini-api-key
TAVILY_API_KEY=your-tavily-api-key
ALLOWED_ORIGINS=http://localhost:3000
```

Start the API:

```bash
uvicorn main:app --reload --port 8000
```

Verify it at [http://localhost:8000](http://localhost:8000). A healthy service returns:

```json
{"status":"ok","service":"ai-data-intelligence-platform"}
```

## Run the Frontend

In a second terminal:

```bash
cd frontend-app
npm install
```

The frontend defaults to `http://localhost:8000`. To use another backend URL, create `frontend-app/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter a request, and select **Run**.

## API Reference

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/` | Health check |
| `POST` | `/api/workflows/start` | Start a workflow with `{ "prompt": "..." }` |
| `GET` | `/api/workflows` | List the latest 50 workflows |
| `GET` | `/api/workflows/{id}/status` | Read workflow status and metadata |
| `GET` | `/api/workflows/{id}/results` | Read extracted records |

Workflow statuses are `pending`, `searching`, `crawling`, `extracting`, `completed`, and `failed`.

Example request:

```bash
curl -X POST http://localhost:8000/api/workflows/start \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Find recent AI startup funding news"}'
```

The response contains a `workflow_id`. Use that ID with the status and results endpoints.

## Demo Cache

For a presentation, a known-good workflow can be returned immediately instead of running a new crawl. After a successful run, add the prompt and workflow UUID to `DEMO_CACHE` in [`backend/main.py`](backend/main.py):

```python
DEMO_CACHE = {
    "find recent ai startup funding news": "workflow-uuid-here",
}
```

The key is matched after trimming and converting the prompt to lowercase.

## Deployment

### Backend

The backend includes a [`Dockerfile`](backend/Dockerfile) and can be deployed to Render, Fly.io, or another container host. Configure `SUPABASE_URL`, `SUPABASE_KEY`, `GEMINI_API_KEY`, `TAVILY_API_KEY`, and `ALLOWED_ORIGINS` in the host's secret or environment-variable settings.

### Frontend

Deploy `frontend-app` to Vercel or any Next.js-compatible host. Set:

```dotenv
NEXT_PUBLIC_API_URL=https://your-backend.example.com
```

After deployment, update the backend's `ALLOWED_ORIGINS` to include the frontend URL. Keep API keys on the backend only; never expose them through `NEXT_PUBLIC_*` variables.

## Security Notes

- Never commit `backend/.env` or `frontend-app/.env.local`.
- Use a server-side Supabase key only in the backend environment.
- Restrict `ALLOWED_ORIGINS` to the domains that should call the API in production.
- The included schema enables broad public policies for the demo workflow. Add authentication and narrower Row Level Security policies before using this with private data.

## License

No license has been specified for this project yet.
