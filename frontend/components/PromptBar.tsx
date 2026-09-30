"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";

const STAGES = ["pending", "searching", "crawling", "extracting", "completed"];

export default function PromptBar({
  onSubmit,
  status,
}: {
  onSubmit: (prompt: string) => void;
  status?: string;
}) {
  const [value, setValue] = useState("");
  const isBusy = status && status !== "completed" && status !== "failed";

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
        className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3"
      >
        <Search className="w-5 h-5 text-gray-400 shrink-0" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder='Describe what you need, e.g. "Find AI startups hiring in London"'
          className="flex-1 outline-none text-base"
          disabled={!!isBusy}
        />
        <button
          type="submit"
          disabled={!!isBusy || !value.trim()}
          className="bg-blue-600 disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2"
        >
          {isBusy && <Loader2 className="w-4 h-4 animate-spin" />}
          {isBusy ? "Working..." : "Run"}
        </button>
      </form>

      {status && (
        <div className="flex items-center gap-2 mt-3 px-1">
          {STAGES.map((s, i) => {
            const currentIndex = STAGES.indexOf(status === "failed" ? "completed" : status);
            const done = i <= currentIndex && status !== "failed";
            return (
              <div key={s} className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-1 rounded-full capitalize ${
                    status === "failed" && s === "completed"
                      ? "bg-red-100 text-red-600"
                      : done
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {status === "failed" && s === "completed" ? "failed" : s}
                </span>
                {i < STAGES.length - 1 && <span className="text-gray-300">→</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
