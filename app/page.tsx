"use client";

import { useEffect, useMemo, useState } from "react";
import { SCENARIOS } from "@/lib/scenarios";
import type { Action, Context, ForcedFailure, Trace } from "@/lib/types";
import { ScenarioPicker } from "@/components/ScenarioPicker";
import { DecisionCard } from "@/components/DecisionCard";
import { TracePanel } from "@/components/TracePanel";
import { ForceFailure } from "@/components/ForceFailure";
import { Badge } from "@/components/ui";

const DEFAULT_SCENARIO = SCENARIOS[0].id;

export default function Home() {
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_SCENARIO);
  const [forcedFailure, setForcedFailure] = useState<ForcedFailure>("none");
  const [useMock, setUseMock] = useState<boolean>(false);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customJson, setCustomJson] = useState<string>(
    () => JSON.stringify(
      { action: SCENARIOS[0].action, context: SCENARIOS[0].context },
      null,
      2,
    ),
  );

  const selected = useMemo(
    () => SCENARIOS.find((s) => s.id === selectedId) ?? SCENARIOS[0],
    [selectedId],
  );

  useEffect(() => {
    setCustomJson(
      JSON.stringify(
        { action: selected.action, context: selected.context },
        null,
        2,
      ),
    );
  }, [selected]);

  async function run() {
    setLoading(true);
    setError(null);

    let action: Action;
    let context: Context;

    if (customOpen) {
      try {
        const parsed = JSON.parse(customJson);
        action = parsed.action;
        context = parsed.context;
      } catch (e: any) {
        setError(`custom JSON is not valid: ${e?.message ?? "unknown"}`);
        setLoading(false);
        return;
      }
    } else {
      action = selected.action;
      context = selected.context;
    }

    try {
      const res = await fetch("/api/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          context,
          forcedFailure,
          mock: useMock,
          scenarioId: customOpen ? undefined : selected.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `HTTP ${res.status}`);
        setTrace(null);
      } else {
        setTrace(data as Trace);
      }
    } catch (e: any) {
      setError(e?.message ?? "network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen">
      {/* Top bar */}
      <header className="border-b border-neutral-900 bg-neutral-950/60 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tracking-tight">
              alfred<span className="text-indigo-400">_</span>
            </span>
            <span className="text-xs text-neutral-500">
              Execution Decision Layer
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1 text-xs text-neutral-400">
              <input
                type="checkbox"
                checked={useMock}
                onChange={(e) => setUseMock(e.target.checked)}
                className="accent-indigo-500"
              />
              Mock LLM
            </label>
            <ForceFailure value={forcedFailure} onChange={setForcedFailure} />
            <button
              onClick={run}
              disabled={loading}
              className="px-4 py-1.5 text-sm rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium"
            >
              {loading ? "Running…" : "Run"}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left column: scenarios + custom */}
        <div className="lg:col-span-3 space-y-3">
          <ScenarioPicker
            scenarios={SCENARIOS}
            selectedId={customOpen ? null : selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setCustomOpen(false);
            }}
          />

          <details
            className="border border-neutral-800 rounded"
            open={customOpen}
            onToggle={(e) =>
              setCustomOpen((e.target as HTMLDetailsElement).open)
            }
          >
            <summary className="px-3 py-2 text-xs text-neutral-400 cursor-pointer hover:text-neutral-200">
              Custom scenario (edit JSON)
            </summary>
            <div className="p-3">
              <textarea
                value={customJson}
                onChange={(e) => setCustomJson(e.target.value)}
                spellCheck={false}
                className="w-full h-80 text-xs bg-neutral-950 border border-neutral-800 rounded p-2 font-mono text-neutral-200 focus:outline-none focus:border-indigo-500"
              />
              <div className="text-xs text-neutral-500 mt-2">
                When this panel is open, Run uses the JSON above instead of the
                selected scenario.
              </div>
            </div>
          </details>

          <div className="text-xs text-neutral-500 border border-neutral-900 rounded p-3 leading-relaxed">
            <div className="font-medium text-neutral-400 mb-1">How to read this</div>
            Pick a scenario on the left. Click Run. The center shows the final
            verdict; the right panel exposes every step — inputs, computed
            signals, the exact prompt sent, raw model output, parse errors, and
            timings. Use the <span className="text-neutral-300">Force</span>{" "}
            dropdown to trigger failure modes.
          </div>
        </div>

        {/* Center column: decision + description */}
        <div className="lg:col-span-5 space-y-4">
          {!customOpen && (
            <div className="border border-neutral-800 rounded p-4 bg-neutral-950/60">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="text-sm font-medium text-neutral-100">
                    {selected.label}
                  </div>
                  <div className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    {selected.blurb}
                  </div>
                </div>
                <Badge tone="gray">{selected.id}</Badge>
              </div>
              <div className="mt-3">
                <div className="text-xs text-neutral-500 mb-1">
                  proposed action
                </div>
                <div className="text-sm text-neutral-200">
                  {selected.action.summary}
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge
                    tone={selected.action.reversible ? "green" : "red"}
                  >
                    {selected.action.reversible
                      ? "reversible"
                      : "irreversible"}
                  </Badge>
                  <Badge
                    tone={
                      selected.action.externallyVisible ? "amber" : "blue"
                    }
                  >
                    {selected.action.externallyVisible
                      ? "externally visible"
                      : "internal"}
                  </Badge>
                  <Badge tone="gray">{selected.action.kind}</Badge>
                </div>
              </div>
            </div>
          )}

          <DecisionCard
            decision={trace?.decision ?? null}
            mock={trace?.mock ?? false}
            loading={loading}
            error={error}
          />
        </div>

        {/* Right column: trace */}
        <div className="lg:col-span-4">
          <TracePanel trace={trace} />
        </div>
      </div>

      <footer className="max-w-[1400px] mx-auto px-4 py-8 text-xs text-neutral-600 text-center">
        alfred_ take-home prototype · decision pipeline only — no tools are
        actually executed
      </footer>
    </main>
  );
}
