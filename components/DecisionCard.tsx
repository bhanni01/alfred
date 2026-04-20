"use client";

import type { Decision, Verdict } from "@/lib/types";
import { Badge } from "./ui";

export function DecisionCard({
  decision,
  mock,
  loading,
  error,
}: {
  decision: Decision | null;
  mock: boolean;
  loading: boolean;
  error: string | null;
}) {
  if (error) {
    return (
      <div className="border border-red-900 bg-red-950/40 rounded p-4">
        <div className="text-red-300 font-medium text-sm mb-1">
          Request failed
        </div>
        <div className="text-xs text-red-200/80">{error}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="border border-neutral-800 rounded p-4 bg-neutral-950/60">
        <div className="text-sm text-neutral-400 animate-pulse">
          Running pipeline…
        </div>
      </div>
    );
  }

  if (!decision) {
    return (
      <div className="border border-neutral-800 rounded p-4 bg-neutral-950/60">
        <div className="text-sm text-neutral-500">
          Pick a scenario and click <span className="text-neutral-300">Run</span> to
          see the decision.
        </div>
      </div>
    );
  }

  const tone = verdictTone(decision.verdict);
  return (
    <div className="border border-neutral-800 rounded p-4 bg-neutral-950/60">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`px-3 py-1 rounded text-sm font-semibold border ${verdictClass(
            decision.verdict,
          )}`}
        >
          {decision.verdict}
        </span>
        {decision.fallback && <Badge tone="red">fallback</Badge>}
        {mock && <Badge tone="indigo">mock LLM</Badge>}
        <span className="ml-auto text-xs text-neutral-500">
          confidence{" "}
          <span className="text-neutral-300">
            {Math.round(decision.confidence * 100)}%
          </span>
        </span>
      </div>

      <div className="mt-3 text-sm text-neutral-200 leading-relaxed">
        {decision.rationale}
      </div>

      {decision.userMessage && (
        <div
          className={`mt-3 text-sm text-neutral-100 leading-relaxed border-l-2 pl-3 ${borderClass(
            decision.verdict,
          )}`}
        >
          <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
            user-facing message
          </div>
          {decision.userMessage}
        </div>
      )}

      <div className="mt-4 h-1.5 w-full bg-neutral-900 rounded overflow-hidden">
        <div
          className={`h-full ${confidenceClass(decision.verdict)}`}
          style={{ width: `${Math.round(decision.confidence * 100)}%` }}
        />
      </div>
    </div>
  );
}

function verdictClass(v: Verdict): string {
  switch (v) {
    case "EXECUTE_SILENT":
      return "bg-green-900/60 text-green-200 border-green-700";
    case "EXECUTE_AND_NOTIFY":
      return "bg-blue-900/60 text-blue-200 border-blue-700";
    case "CONFIRM":
      return "bg-amber-900/60 text-amber-200 border-amber-700";
    case "CLARIFY":
      return "bg-purple-900/60 text-purple-200 border-purple-700";
    case "REFUSE":
      return "bg-red-900/60 text-red-200 border-red-700";
  }
}

function verdictTone(v: Verdict) {
  switch (v) {
    case "EXECUTE_SILENT":
      return "green";
    case "EXECUTE_AND_NOTIFY":
      return "blue";
    case "CONFIRM":
      return "amber";
    case "CLARIFY":
      return "purple";
    case "REFUSE":
      return "red";
  }
}

function borderClass(v: Verdict): string {
  switch (v) {
    case "EXECUTE_SILENT":
      return "border-green-700";
    case "EXECUTE_AND_NOTIFY":
      return "border-blue-700";
    case "CONFIRM":
      return "border-amber-700";
    case "CLARIFY":
      return "border-purple-700";
    case "REFUSE":
      return "border-red-700";
  }
}

function confidenceClass(v: Verdict): string {
  switch (v) {
    case "EXECUTE_SILENT":
      return "bg-green-600";
    case "EXECUTE_AND_NOTIFY":
      return "bg-blue-600";
    case "CONFIRM":
      return "bg-amber-600";
    case "CLARIFY":
      return "bg-purple-600";
    case "REFUSE":
      return "bg-red-600";
  }
}
