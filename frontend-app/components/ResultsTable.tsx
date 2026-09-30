"use client";

import { useMemo, useState } from "react";
import { ExtractedRow, Workflow } from "@/lib/api";
import { Download, ExternalLink } from "lucide-react";

export default function ResultsTable({
  rows,
  schema,
}: {
  rows: ExtractedRow[];
  schema?: Workflow["schema_definition"];
}) {
  const [filter, setFilter] = useState("");

  const columns = useMemo(() => {
    if (schema?.fields?.length) return schema.fields.map((f) => f.name);
    const keys = new Set<string>();
    rows.forEach((r) => Object.keys(r.payload || {}).forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [schema, rows]);

  const filteredRows = useMemo(() => {
    if (!filter.trim()) return rows;
    const f = filter.toLowerCase();
    return rows.filter((r) =>
      Object.values(r.payload || {}).some((v) => String(v).toLowerCase().includes(f)) ||
      r.source_url.toLowerCase().includes(f)
    );
  }, [rows, filter]);

  function downloadCSV() {
    const header = [...columns, "source_url"];
    const lines = [header.join(",")];
    for (const r of filteredRows) {
      const line = [...columns.map((c) => csvEscape(r.payload?.[c] ?? "")), csvEscape(r.source_url)];
      lines.push(line.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "extracted_data.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function csvEscape(value: string) {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  if (rows.length === 0) {
    return <p className="text-gray-400 text-sm mt-6">No results yet for this workflow.</p>;
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter results..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 outline-none"
        />
        <button
          onClick={downloadCSV}
          className="flex items-center gap-2 text-sm font-medium bg-gray-900 text-white px-3 py-2 rounded-lg"
        >
          <Download className="w-4 h-4" /> Download CSV
        </button>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((c) => (
                <th key={c} className="text-left px-4 py-2 font-medium text-gray-600 capitalize">
                  {c.replace(/_/g, " ")}
                </th>
              ))}
              <th className="text-left px-4 py-2 font-medium text-gray-600">Source</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                {columns.map((c) => (
                  <td key={c} className="px-4 py-2 text-gray-800 max-w-xs truncate">
                    {r.payload?.[c] ?? ""}
                  </td>
                ))}
                <td className="px-4 py-2">
                  <a
                    href={r.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 flex items-center gap-1 text-xs"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
