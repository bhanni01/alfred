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
      <div className="border border-red-200 bg-red-50 rounded-lg p-5">
        <div className="text-red-700 font-medium text-sm mb-1">
          Request failed
        </div>
        <div className="text-xs text-red-600">{error}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-5 bg-white">
        <div className="text-sm text-gray-500 animate-pulse">
          Running pipeline…
        </div>
      </div>
    );
  }

  if (!decision) {
    return (
      <div className="border border-gray-200 rounded-lg p-5 bg-white">
        <div className="text-sm text-gray-500">
          Pick a scenario and click{" "}
          <span className="text-gray-900 font-medium">Run</span> to see the
          decision.
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`px-3 py-1 rounded-md text-sm font-semibold border ${verdictClass(
            decision.verdict,
          )}`}
        >
          {decision.verdict}
        </span>
        {decision.fallback && <Badge tone="red">fallback</Badge>}
        {mock && <Badge tone="indigo">mock LLM</Badge>}
        <span className="ml-auto text-xs text-gray-500">
          confidence{" "}
          <span className="text-gray-900 font-medium">
            {Math.round(decision.confidence * 100)}%
          </span>
        </span>
      </div>

      <div className="mt-4 text-sm text-gray-800 leading-relaxed">
        {decision.rationale}
      </div>

      {decision.userMessage && (
        <div
          className={`mt-4 text-sm text-gray-900 leading-relaxed border-l-2 pl-3 ${borderClass(
            decision.verdict,
          )}`}
        >
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-1 font-medium">
            user-facing message
          </div>
          {decision.userMessage}
        </div>
      )}

      <div className="mt-5 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
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
      return "bg-green-50 text-green-700 border-green-200";
    case "EXECUTE_AND_NOTIFY":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "CONFIRM":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "CLARIFY":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "REFUSE":
      return "bg-red-50 text-red-700 border-red-200";
  }
}

function borderClass(v: Verdict): string {
  switch (v) {
    case "EXECUTE_SILENT":
      return "border-green-400";
    case "EXECUTE_AND_NOTIFY":
      return "border-blue-400";
    case "CONFIRM":
      return "border-amber-400";
    case "CLARIFY":
      return "border-purple-400";
    case "REFUSE":
      return "border-red-400";
  }
}

function confidenceClass(v: Verdict): string {
  switch (v) {
    case "EXECUTE_SILENT":
      return "bg-green-500";
    case "EXECUTE_AND_NOTIFY":
      return "bg-blue-500";
    case "CONFIRM":
      return "bg-amber-500";
    case "CLARIFY":
      return "bg-purple-500";
    case "REFUSE":
      return "bg-red-500";
  }
}
