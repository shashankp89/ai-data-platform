
# AI Data Intelligence Platform — Code Cubicle 6.0 (PS-01)

Turns a plain-English request like "Find AI startups hiring in London" into a
clean, structured, source-linked dataset shown on a live dashboard.

This README is the full step-by-step guide. Follow it top to bottom, in order.

---
## 0. Accounts you need (10 minutes, all free tiers)

1. **GitHub** — github.com — you probably already have this. Needed to push code so Vercel/Render can deploy it.
2. **Supabase** — supabase.com — free Postgres database.
3. **OpenAI** — platform.openai.com — needed for gpt-4o-mini. Add a small amount of billing credit ($5 is plenty).
4. **Tavily** — tavily.com — free API key, used for web search/discovery.
5. **Vercel** — vercel.com — free hosting for the Next.js frontend.
6. **Render** — render.com — free hosting for the Python backend.

Sign up for all six now before writing any code, so keys are ready.

---
## 1. Set up Supabase (the database)

1. Go to supabase.com → New Project. Pick any name/region, set a database password (save it somewhere).
2. Wait ~2 minutes for it to finish provisioning.
3. In the left sidebar, click **SQL Editor** → **New query**.
4. Open `backend/supabase_schema.sql` from this project, copy ALL of it, paste into the editor, click **Run**.
5. You should see "Success. No rows returned." — this created your `workflows` and `extracted_data` tables.
6. Go to **Project Settings → API**. Copy:
   - **Project URL** → this is `SUPABASE_URL`
   - **service_role key** (NOT anon key, since we write from the backend) → this is `SUPABASE_KEY`

---
## 2. Get your API keys

- **OpenAI:** platform.openai.com → API keys → Create new secret key. Starts with `sk-`.
- **Tavily:** tavily.com → dashboard → API keys. Starts with `tvly-`.

Keep these two plus your Supabase URL/key somewhere safe (a notes file) — you'll paste them in step 3.

---
## 3. Run the backend locally

You need **Python 3.14** installed (python.org/downloads — check "Add to PATH" during install on Windows).

```bash
cd backend
python -m venv venv

# Activate the virtual environment:
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate
pip install -r requirements.txt

python -m playwright install --with-deps chromium
```

Now set up your environment file:
```bash
# Copy the example file and rename it to .env
cp .env.example .env       # Mac/Linux
copy .env.example .env     # Windows
```
Open `.env` in any text editor and paste in your real `SUPABASE_URL`, `SUPABASE_KEY`, `OPENAI_API_KEY`, and `TAVILY_API_KEY` from steps 1–2. Leave `ALLOWED_ORIGINS` as is for now.

Run the server:
```bash
uvicorn main:app --reload --port 8000
```

Open **http://localhost:8000** in your browser — you should see `{"status":"ok",...}`. That means the backend is alive.

### Test it with a real request
Open a **second** terminal and run:
```bash
curl -X POST http://localhost:8000/api/workflows/start -H "Content-Type: application/json" -d "{\"prompt\": \"Find recent AI startup funding news\"}"
```
You'll get back `{"workflow_id": "...", "cached": false}`. Copy that ID and check progress:
```bash
curl http://localhost:8000/api/workflows/<paste-id-here>/status
```
Run that a few times over ~30-60 seconds. Status will move: `pending` → `searching` → `crawling` → `extracting` → `completed` (or `failed`, if something went wrong — check the terminal running uvicorn for the error). Once `completed`, check results:
```bash
curl http://localhost:8000/api/workflows/<id>/results
```
If you see JSON records with real data, **your backend works end to end.** This is the most important checkpoint — don't move to the frontend until this works.

---
## 4. Run the frontend locally

You need **Node.js 18+** installed (nodejs.org).

Scaffold the Next.js app (this creates all the boilerplate — config files, Tailwind setup, TypeScript config — that we don't need to write by hand):
```bash
npx create-next-app@latest frontend-app --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*"
```
Answer the prompts with defaults (just press Enter).

Now copy our custom files INTO that generated project, overwriting the placeholder ones:
- Copy `frontend/app/page.tsx` → into `frontend-app/app/page.tsx` (overwrite it)
- Copy the whole `frontend/components/` folder → into `frontend-app/components/`
- Copy the whole `frontend/lib/` folder → into `frontend-app/lib/`
- Copy `frontend/.env.local.example` → into `frontend-app/.env.local` (rename it)

Install the two icon/UI libraries our components use:
```bash
cd frontend-app
npm install lucide-react
```

Run it:
```bash
npm run dev
```
Open **http://localhost:3000**. You should see the dashboard. Type a prompt, hit Run, and watch the status pills move through the stages, then see a results table with a working "Download CSV" button.

If nothing loads or you see CORS errors in the browser console, double check the backend is running on port 8000 and `ALLOWED_ORIGINS` in `backend/.env` includes `http://localhost:3000`.

---
## 5. Deploy the backend (Render)

1. Push the `backend/` folder to a GitHub repo (a new repo is fine, e.g. `ai-data-platform-backend`).
2. Go to render.com → New → Web Service → connect your GitHub repo.
3. Render will detect the `Dockerfile` automatically. If asked, choose **Docker** as the environment.
4. Under **Environment Variables**, add: `SUPABASE_URL`, `SUPABASE_KEY`, `OPENAI_API_KEY`, `TAVILY_API_KEY`, and `ALLOWED_ORIGINS` (you'll update this last one after deploying the frontend).
5. Click **Create Web Service**. First build takes 5-10 minutes (it's installing a headless browser).
6. Once live, Render gives you a URL like `https://ai-data-platform-backend.onrender.com`. Test it: visit that URL in a browser, you should see the `{"status":"ok"}` response again.

**Free-tier note:** Render's free web services sleep after inactivity and take ~30-50 seconds to "wake up" on the first request. Hit your backend URL once a few minutes before your live demo to warm it up.

---
## 6. Deploy the frontend (Vercel)

1. Push `frontend-app/` (the full generated Next.js project, with our files copied in) to its own GitHub repo.
2. Go to vercel.com → Add New → Project → import that repo.
3. In the "Environment Variables" section during setup, add:
   `NEXT_PUBLIC_API_URL` = your real Render backend URL from step 5.
4. Click **Deploy**. Takes ~1-2 minutes.
5. You'll get a live URL like `https://ai-data-platform.vercel.app`.

Now go back to Render, edit the `ALLOWED_ORIGINS` environment variable to include your real Vercel URL (comma-separated if you keep localhost too), and redeploy the backend so CORS allows your live frontend to call it.

**You now have a fully hosted, working product.** Open the Vercel URL from any device and test the whole flow again.

---
## 7. The "Cache & Win" demo safety net (do this the night before judging)

Live web crawling can occasionally be slow or fail (site changes, rate limits, flaky wifi at the venue). Don't let that happen during your 3-minute pitch.

1. The night before, run 2-3 impressive, specific prompts through your LIVE hosted app and let them complete naturally end-to-end.
2. In Supabase, open the `workflows` table, find each of those rows, and copy their `id` (a UUID).
3. Open `backend/main.py`, find the `DEMO_CACHE` dictionary near the top, and fill it in:
   ```python
   DEMO_CACHE = {
       "find ai startups hiring in london": "the-uuid-you-copied",
   }
   ```
   The key must be the exact prompt text, lowercase, trimmed.
4. Commit and redeploy the backend to Render.
5. During your demo, type that EXACT prompt. The backend recognizes it and returns the already-completed workflow instantly — the dashboard will jump straight to "Completed" with real data, with zero dependency on live crawling working in front of judges.
6. Still show 1 live, non-cached prompt too if time allows, to prove the system genuinely works — just don't make your main pitch moment depend on it.

---
## 8. What to say in your pitch (aligned to the rubric)

The judging rubric (from the problem statement) explicitly wants: natural-language understanding, dynamic workflow design, multi-source collection, cleaning/validation/dedup, source traceability, monitoring/management, dashboard presentation, workflow history, and search/filter/export. Walk through the demo hitting each of these in order:

1. "You type what you need in plain English — no scraper code, no config." (natural language)
2. "Watch the status bar — it's discovering sources and deciding what fields to extract *based on your request*." (dynamic workflow design)
3. "It pulled from multiple live sources." (multi-source, point at rows with different `source_url`s)
4. "Every row is clean and deduplicated — plug this straight into a CRM or spreadsheet." (validation/cleaning)
5. Click a "View source" link live. "Every single field is traceable back to the exact page it came from." (traceability — this is the strongest differentiator, emphasize it)
6. Click the sidebar. "Every workflow is saved — you can revisit and re-export any past run." (history/management)
7. Click Download CSV. "One click, export-ready." (export)

---
## Project structure reference

```
ai-data-platform/
├── backend/
│   ├── main.py              # FastAPI app, endpoints, demo cache
│   ├── engine.py            # The extraction pipeline (search/schema/crawl/extract/dedupe)
│   ├── database.py          # Supabase client
│   ├── requirements.txt
│   ├── .env.example
│   ├── Dockerfile
│   └── supabase_schema.sql
└── frontend/                 # Files to copy into a generated create-next-app project
    ├── app/page.tsx
    ├── components/Sidebar.tsx
    ├── components/PromptBar.tsx
    ├── components/ResultsTable.tsx
    ├── lib/api.ts
    └── .env.local.example
```
