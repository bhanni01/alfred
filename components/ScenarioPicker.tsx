"use client";

import type { Scenario } from "@/lib/types";
import { Badge } from "./ui";

export function ScenarioPicker({
  scenarios,
  selectedId,
  onSelect,
}: {
  scenarios: Scenario[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
        Scenarios
      </div>
      {scenarios.map((s) => {
        const selected = s.id === selectedId;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left p-3 rounded border transition-colors ${
              selected
                ? "border-indigo-600 bg-indigo-950/40"
                : "border-neutral-800 hover:border-neutral-700 bg-neutral-950/60"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-sm text-neutral-100">
                {s.label}
              </div>
              <Badge tone={diffTone(s.difficulty)}>{s.difficulty}</Badge>
            </div>
            <div className="text-xs text-neutral-400 mt-1 leading-relaxed">
              {s.blurb}
            </div>
            <div className="mt-2">
              <Badge tone="gray">expected: {s.expectedVerdict}</Badge>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function diffTone(d: Scenario["difficulty"]) {
  switch (d) {
    case "easy":
      return "green";
    case "ambiguous":
      return "amber";
    case "adversarial":
      return "red";
    default:
      return "default";
  }
}
