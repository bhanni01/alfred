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
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-neutral-500 font-medium">
        Scenarios
      </div>
      {scenarios.map((s) => {
        const selected = s.id === selectedId;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              selected
                ? "border-blue-600 bg-blue-50/40 shadow-sm dark:border-blue-500 dark:bg-blue-950/20"
                : "border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm dark:border-neutral-800 dark:hover:border-neutral-700 dark:bg-neutral-950"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-sm text-gray-900 dark:text-neutral-100">
                {s.label}
              </div>
              <Badge tone={diffTone(s.difficulty)}>{s.difficulty}</Badge>
            </div>
            <div className="text-xs text-gray-600 dark:text-neutral-400 mt-1.5 leading-relaxed">
              {s.blurb}
            </div>
            <div className="mt-2.5">
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
