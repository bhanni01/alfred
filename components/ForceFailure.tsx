"use client";

import type { ForcedFailure } from "@/lib/types";

const OPTIONS: Array<{ value: ForcedFailure; label: string; note: string }> = [
  { value: "none", label: "none", note: "run normally" },
  { value: "timeout", label: "timeout", note: "LLM exceeds 11s → fallback" },
  { value: "malformed", label: "malformed output", note: "bad schema → retry → fallback" },
  { value: "missing-context", label: "missing context", note: "strip required param → CLARIFY short-circuit" },
  { value: "policy-violation", label: "policy violation", note: "force REFUSE short-circuit" },
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
      <label className="text-xs text-neutral-500 uppercase tracking-wider">
        Force
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ForcedFailure)}
        className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 hover:border-neutral-500 focus:outline-none focus:border-indigo-500"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="text-xs text-neutral-500 hidden md:inline">
        {current.note}
      </span>
    </div>
  );
}
