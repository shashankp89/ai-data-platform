"use client";

import { Workflow } from "@/lib/api";
import { Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

function StatusIcon({ status }: { status: Workflow["status"] }) {
  if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-500" />;
  if (status === "pending") return <Clock className="w-4 h-4 text-gray-400" />;
  return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
}

export default function Sidebar({
  workflows,
  activeId,
  onSelect,
}: {
  workflows: Workflow[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="w-72 border-r border-gray-200 h-full overflow-y-auto bg-gray-50 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">
          Workflow History
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {workflows.length === 0 && (
          <p className="text-sm text-gray-400 p-4">No workflows yet. Start one on the right.</p>
        )}
        {workflows.map((w) => (
          <button
            key={w.id}
            onClick={() => onSelect(w.id)}
            className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-100 transition flex items-start gap-2 ${
              activeId === w.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
            }`}
          >
            <div className="mt-0.5">
              <StatusIcon status={w.status} />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-800 line-clamp-2">{w.prompt_text}</p>
              <p className="text-xs text-gray-400 mt-1 capitalize">{w.status}</p>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
