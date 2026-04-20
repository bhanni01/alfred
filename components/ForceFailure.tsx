"use client";

import type { ForcedFailure } from "@/lib/types";

const OPTIONS: Array<{ value: ForcedFailure; label: string; note: string }> = [
  { value: "none", label: "none", note: "run normally" },
  { value: "timeout", label: "timeout", note: "LLM exceeds 11s → fallback" },
  {
    value: "malformed",
    label: "malformed output",
    note: "bad schema → retry → fallback",
  },
  {
    value: "missing-context",
    label: "missing context",
    note: "strip required param → CLARIFY",
  },
  {
    value: "policy-violation",
    label: "policy violation",
    note: "force REFUSE short-circuit",
  },
];

export function ForceFailure({
  value,
  onChange,
}: {
  value: ForcedFailure;
  onChange: (v: ForcedFailure) => void;
}) {
  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0];
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">
        Force
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ForcedFailure)}
        className="bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800 hover:border-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="text-xs text-gray-500 hidden md:inline">
        {current.note}
      </span>
    </div>
  );
}
