"use client";

import { useEffect, useState } from "react";
import { FollowUp, askFollowUp, listFollowUps } from "@/lib/api";
import { Send, Loader2, MessageCircleQuestion } from "lucide-react";

const SUGGESTIONS = [
  "Summarize the main pattern across these results.",
  "Which rows look the most relevant or high-quality?",
  "Are there any gaps or missing information in this data?",
];

export default function FollowUpChat({ workflowId }: { workflowId: string }) {
  const [history, setHistory] = useState<FollowUp[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listFollowUps(workflowId).then(setHistory).catch(() => {});
  }, [workflowId]);

  async function submit(q: string) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await askFollowUp(workflowId, q.trim());
      setHistory((prev) => [...prev, result]);
      setQuestion("");
    } catch (e) {
      setError("Couldn't get an answer. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 border border-gray-200 rounded-xl p-5 bg-gray-50">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircleQuestion className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-800">Ask a follow-up about these results</h3>
      </div>

      {history.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 hover:bg-gray-100"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
          {history.map((h) => (
            <div key={h.id}>
              <p className="text-sm font-medium text-gray-900">{h.question}</p>
              <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{h.answer}</p>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Which of these are based in Europe?"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none bg-white"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="bg-blue-600 disabled:bg-gray-300 text-white p-2 rounded-lg"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      <p className="text-xs text-gray-400 mt-2">
        Answers are generated only from this workflow&apos;s extracted data — not the open web.
      </p>
    </div>
  );
}
