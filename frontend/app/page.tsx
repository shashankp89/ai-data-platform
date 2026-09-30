"use client";

import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import PromptBar from "@/components/PromptBar";
import ResultsTable from "@/components/ResultsTable";
import {
  Workflow,
  ExtractedRow,
  startWorkflow,
  listWorkflows,
  getWorkflowStatus,
  getWorkflowResults,
} from "@/lib/api";

export default function Home() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [rows, setRows] = useState<ExtractedRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshSidebar = useCallback(() => {
    listWorkflows().then(setWorkflows).catch(() => {});
  }, []);

  useEffect(() => {
    refreshSidebar();
  }, [refreshSidebar]);

  // Poll active workflow status every 2s until it's done
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;

    async function poll() {
      try {
        const wf = await getWorkflowStatus(activeId!);
        if (cancelled) return;
        setActiveWorkflow(wf);
        if (wf.status === "completed") {
          const results = await getWorkflowResults(activeId!);
          setRows(results);
          refreshSidebar();
        } else if (wf.status === "failed") {
          refreshSidebar();
        } else {
          setTimeout(poll, 2000);
        }
      } catch (e) {
        setError("Lost connection to the backend.");
      }
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [activeId, refreshSidebar]);

  async function handleSubmit(prompt: string) {
    setError(null);
    setRows([]);
    try {
      const { workflow_id } = await startWorkflow(prompt);
      setActiveId(workflow_id);
      refreshSidebar();
    } catch (e) {
      setError("Could not start workflow. Is the backend running?");
    }
  }

  async function handleSelect(id: string) {
    setActiveId(id);
    setRows([]);
    const wf = await getWorkflowStatus(id);
    setActiveWorkflow(wf);
    if (wf.status === "completed") {
      const results = await getWorkflowResults(id);
      setRows(results);
    }
  }

  return (
    <div className="flex h-screen">
      <Sidebar workflows={workflows} activeId={activeId} onSelect={handleSelect} />
      <main className="flex-1 overflow-y-auto p-8 bg-white">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">AI Data Intelligence Platform</h1>
        <p className="text-gray-500 mb-6">
          Describe what you need in plain English. We&apos;ll find it, extract it, and prove where it came from.
        </p>

        <PromptBar onSubmit={handleSubmit} status={activeWorkflow?.status} />

        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

        {activeWorkflow?.status === "completed" && (
          <ResultsTable rows={rows} schema={activeWorkflow.schema_definition} />
        )}
      </main>
    </div>
  );
}
