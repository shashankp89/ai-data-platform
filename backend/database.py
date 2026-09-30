"""
database.py
Sets up a single shared Supabase client for the whole backend.
"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        "SUPABASE_URL and SUPABASE_KEY are missing. "
        "Copy .env.example to .env and fill in your real Supabase credentials."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
