"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";

const uiFont = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "700"] });
const dataFont = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"] });

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type WorkflowStatus =
  | "idle"
  | "searching"
  | "crawling"
  | "extracting"
  | "completed"
  | "failed";

type ResultRow = {
  id: string;
  workflow_id: string;
  source_url: string;
  payload: Record<string, string>;
  created_at: string;
};

const STAGES: { key: WorkflowStatus; label: string }[] = [
  { key: "searching", label: "Finding sources" },
  { key: "crawling", label: "Reading pages" },
  { key: "extracting", label: "Extracting fields" },
  { key: "completed", label: "Done" },
];

function stageIndex(status: WorkflowStatus) {
  return STAGES.findIndex((s) => s.key === status);
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadCsv(columns: string[], rows: ResultRow[]) {
  const header = ["source_url", ...columns];
  const lines = [header.map(escapeCsvCell).join(",")];
  for (const row of rows) {
    const line = [row.source_url, ...columns.map((c) => row.payload[c] ?? "")];
    lines.push(line.map((cell) => escapeCsvCell(String(cell))).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `extraction-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkflowStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  async function fetchResults(id: string) {
    try {
      const res = await fetch(`${API_BASE}/api/workflows/${id}/results`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {}
  }

  async function pollStatus(id: string) {
    try {
      const res = await fetch(`${API_BASE}/api/workflows/${id}/status`);
      const data = await res.json();
      const nextStatus: WorkflowStatus = data.status ?? "failed";
      setStatus(nextStatus);
      if (nextStatus === "completed") {
        stopPolling();
        await fetchResults(id);
      } else if (nextStatus === "failed") {
        stopPolling();
        setErrorMessage(data.error_message ?? "The workflow failed. Try a different prompt.");
      }
    } catch {
      stopPolling();
      setStatus("failed");
      setErrorMessage("Lost connection to the backend while checking status.");
    }
  }

  async function handleRun() {
    if (!prompt.trim() || status === "searching" || status === "crawling" || status === "extracting") {
      return;
    }
    setErrorMessage(null);
    setResults([]);
    setWorkflowId(null);
    setStatus("searching");

    try {
      const res = await fetch(`${API_BASE}/api/workflows/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      setWorkflowId(data.workflow_id);
      pollRef.current = setInterval(() => pollStatus(data.workflow_id), 1500);
    } catch {
      setStatus("failed");
      setErrorMessage("Couldn't reach the backend. Is it running on " + API_BASE + "?");
    }
  }

  const columns = useMemo(() => {
    const set = new Set<string>();
    for (const row of results) {
      Object.keys(row.payload || {}).forEach((k) => set.add(k));
    }
    return Array.from(set);
  }, [results]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r) => set.add(r.source_url));
    return Array.from(set);
  }, [results]);

  const filteredRows = useMemo(() => {
    let rows = results;
    if (sourceFilter !== "all") {
      rows = rows.filter((r) => r.source_url === sourceFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => {
        const inPayload = Object.values(r.payload || {}).some((v) =>
          String(v).toLowerCase().includes(q)
        );
        return inPayload || r.source_url.toLowerCase().includes(q);
      });
    }
    if (sortColumn) {
      rows = [...rows].sort((a, b) => {
        const av = (a.payload[sortColumn] ?? "").toString();
        const bv = (b.payload[sortColumn] ?? "").toString();
        const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [results, sourceFilter, search, sortColumn, sortDir]);

  function toggleSort(col: string) {
    if (sortColumn === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDir("asc");
    }
  }

  const isRunning = status === "searching" || status === "crawling" || status === "extracting";
  const currentStageIdx = stageIndex(status);

  return (
    <main
      className={`${uiFont.className} min-h-screen bg-[#0B0E14] text-[#E8EAED]`}
    >
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Header */}
        <header className="mb-8 flex items-baseline justify-between border-b border-[#232A36] pb-5">
          <div>
            <h1 className="text-xl font-medium tracking-tight">Extraction console</h1>
            <p className="mt-1 text-sm text-[#7C8697]">
              Describe what to find. It searches, reads the pages, and pulls out the fields that matter.
            </p>
          </div>
        </header>

        {/* Command bar */}
        <div className="mb-6 flex items-stretch gap-2">
          <div className="flex flex-1 items-center rounded-sm border border-[#232A36] bg-[#12161F] px-3">
            <span className="mr-2 text-[#7C8697]">{">"}</span>
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRun()}
              placeholder="e.g. Find recent AI startup funding news"
              className={`${dataFont.className} flex-1 bg-transparent py-3 text-sm text-[#E8EAED] outline-none placeholder:text-[#4B5563]`}
              disabled={isRunning}
            />
          </div>
          <button
            onClick={handleRun}
            disabled={isRunning || !prompt.trim()}
            className="rounded-sm border border-[#F2B84B] bg-[#F2B84B] px-5 text-sm font-medium text-[#0B0E14] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:border-[#3A4150] disabled:bg-[#3A4150] disabled:text-[#7C8697] disabled:opacity-100"
          >
            {isRunning ? "Running…" : "Run"}
          </button>
        </div>

        {/* Stage tracker */}
        {status !== "idle" && (
          <div className="mb-8 flex items-center gap-0 border border-[#232A36] bg-[#12161F] px-4 py-4">
            {STAGES.map((stage, idx) => {
              const isDone = status === "completed" || idx < currentStageIdx || (status === "failed" && idx < Math.max(currentStageIdx, 0));
              const isActive = idx === currentStageIdx && isRunning;
              const isFailedHere = status === "failed" && idx === Math.max(currentStageIdx, 0);
              return (
                <div key={stage.key} className="flex flex-1 items-center last:flex-none">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isFailedHere
                          ? "bg-red-500"
                          : isActive
                          ? "animate-pulse bg-[#F2B84B]"
                          : isDone
                          ? "bg-[#F2B84B]"
                          : "bg-[#3A4150]"
                      }`}
                    />
                    <span
                      className={`text-xs ${
                        isActive || isDone ? "text-[#E8EAED]" : "text-[#7C8697]"
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>
                  {idx < STAGES.length - 1 && (
                    <div className="mx-3 h-px flex-1 bg-[#232A36]" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {errorMessage && (
          <div className="mb-8 border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter results…"
                className={`${dataFont.className} rounded-sm border border-[#232A36] bg-[#12161F] px-3 py-2 text-xs text-[#E8EAED] outline-none placeholder:text-[#4B5563] focus:border-[#7C8697]`}
              />
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className={`${dataFont.className} rounded-sm border border-[#232A36] bg-[#12161F] px-3 py-2 text-xs text-[#E8EAED] outline-none focus:border-[#7C8697]`}
              >
                <option value="all">All sources ({sources.length})</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/^https?:\/\//, "").slice(0, 50)}
                  </option>
                ))}
              </select>
              <div className="flex-1" />
              <span className="text-xs text-[#7C8697]">
                {filteredRows.length} of {results.length} rows
              </span>
              <button
                onClick={() => downloadCsv(columns, filteredRows)}
                className="rounded-sm border border-[#232A36] bg-[#12161F] px-3 py-2 text-xs font-medium text-[#E8EAED] transition-colors hover:border-[#F2B84B] hover:text-[#F2B84B]"
              >
                Download CSV
              </button>
            </div>

            <div className="overflow-x-auto border border-[#232A36]">
              <table className={`${dataFont.className} w-full text-left text-xs`}>
                <thead>
                  <tr className="border-b border-[#232A36] bg-[#12161F]">
                    <th className="whitespace-nowrap px-3 py-2 font-medium text-[#7C8697]">
                      source
                    </th>
                    {columns.map((col) => (
                      <th
                        key={col}
                        onClick={() => toggleSort(col)}
                        className="cursor-pointer whitespace-nowrap px-3 py-2 font-medium text-[#7C8697] hover:text-[#E8EAED]"
                      >
                        {col}
                        {sortColumn === col && (
                          <span className="ml-1 text-[#F2B84B]">
                            {sortDir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="border-b border-[#232A36] hover:bg-[#12161F]">
                      <td className="max-w-[180px] truncate px-3 py-2 text-[#7C8697]" title={row.source_url}>
                        {row.source_url.replace(/^https?:\/\//, "")}
                      </td>
                      {columns.map((col) => (
                        <td key={col} className="whitespace-nowrap px-3 py-2 text-[#E8EAED]">
                          {row.payload[col] || <span className="text-[#3A4150]">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {status === "completed" && results.length === 0 && (
          <div className="border border-[#232A36] bg-[#12161F] px-4 py-6 text-center text-sm text-[#7C8697]">
            No records matched this prompt. Try rephrasing it or widening the request.
          </div>
        )}
      </div>
    </main>
  );
}
