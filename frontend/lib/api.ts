// lib/api.ts
// Small wrapper around fetch() so components don't repeat base URLs everywhere.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type Workflow = {
  id: string;
  prompt_text: string;
  status: "pending" | "searching" | "crawling" | "extracting" | "completed" | "failed";
  schema_definition?: { fields: { name: string; description: string }[] };
  created_at: string;
};

export type ExtractedRow = {
  id: string;
  workflow_id: string;
  source_url: string;
  payload: Record<string, string>;
  created_at: string;
};

export async function startWorkflow(prompt: string): Promise<{ workflow_id: string }> {
  const res = await fetch(`${API_BASE}/api/workflows/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error("Failed to start workflow");
  return res.json();
}

export async function listWorkflows(): Promise<Workflow[]> {
  const res = await fetch(`${API_BASE}/api/workflows`);
  if (!res.ok) throw new Error("Failed to list workflows");
  return res.json();
}

export async function getWorkflowStatus(id: string): Promise<Workflow> {
  const res = await fetch(`${API_BASE}/api/workflows/${id}/status`);
  if (!res.ok) throw new Error("Failed to get status");
  return res.json();
}

export async function getWorkflowResults(id: string): Promise<ExtractedRow[]> {
  const res = await fetch(`${API_BASE}/api/workflows/${id}/results`);
  if (!res.ok) throw new Error("Failed to get results");
  return res.json();
}
