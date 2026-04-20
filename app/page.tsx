"use client";

import { useEffect, useMemo, useState } from "react";
import { SCENARIOS } from "@/lib/scenarios";
import type { Action, Context, ForcedFailure, Trace } from "@/lib/types";
import { ScenarioPicker } from "@/components/ScenarioPicker";
import { DecisionCard } from "@/components/DecisionCard";
import { TracePanel } from "@/components/TracePanel";
import { ForceFailure } from "@/components/ForceFailure";
import { ThemeToggle } from "@/components/ThemeToggle";
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
  const [customJson, setCustomJson] = useState<string>(() =>
    JSON.stringify(
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
    <main className="min-h-screen bg-white dark:bg-neutral-950">
      {/* Top nav */}
      <header className="border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-baseline gap-3">
            <span className="text-xl font-semibold tracking-tight text-gray-900 dark:text-neutral-100">
              alfred<span className="text-blue-600 dark:text-blue-400">_</span>
            </span>
            <span className="text-gray-300 dark:text-neutral-700">|</span>
            <span className="text-sm text-gray-600 dark:text-neutral-400">
              Execution Decision Layer
            </span>
          </div>

          <div className="ml-auto flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={useMock}
                onChange={(e) => setUseMock(e.target.checked)}
                className="accent-blue-600"
              />
              Mock LLM
            </label>
            <ForceFailure value={forcedFailure} onChange={setForcedFailure} />
            <button
              onClick={run}
              disabled={loading}
              className="px-5 py-1.5 text-sm rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium shadow-sm"
            >
              {loading ? "Running…" : "Run"}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero-style sub-header */}
      <div className="border-b border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/40">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <h1 className="text-lg font-medium text-gray-900 dark:text-neutral-100">
            Should alfred_ execute this?
          </h1>
          <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1 leading-relaxed max-w-2xl">
            Given a proposed action and the surrounding conversation, decide
            whether to execute silently, execute and notify, confirm, clarify,
            or refuse — with the full pipeline visible.
          </p>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: scenarios + custom */}
        <div className="lg:col-span-3 space-y-4">
          <ScenarioPicker
            scenarios={SCENARIOS}
            selectedId={customOpen ? null : selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setCustomOpen(false);
            }}
          />

          <details
            className="border border-gray-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-950"
            open={customOpen}
            onToggle={(e) =>
              setCustomOpen((e.target as HTMLDetailsElement).open)
            }
          >
            <summary className="px-4 py-2.5 text-xs text-gray-600 dark:text-neutral-400 cursor-pointer hover:text-gray-900 dark:hover:text-neutral-100 font-medium">
              Custom scenario (edit JSON)
            </summary>
            <div className="p-4">
              <textarea
                value={customJson}
                onChange={(e) => setCustomJson(e.target.value)}
                spellCheck={false}
                className="w-full h-80 text-xs bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-md p-2 font-mono text-gray-800 dark:text-neutral-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <div className="text-xs text-gray-500 dark:text-neutral-500 mt-2 leading-relaxed">
                When this panel is open, Run uses the JSON above instead of the
                selected scenario.
              </div>
            </div>
          </details>

          <div className="text-xs text-gray-600 dark:text-neutral-400 border border-gray-200 dark:border-neutral-800 rounded-lg p-4 leading-relaxed bg-gray-50/50 dark:bg-neutral-900/40">
            <div className="font-medium text-gray-900 dark:text-neutral-100 mb-1">
              How to read this
            </div>
            Pick a scenario on the left. Click Run. The center shows the final
            verdict; the right panel exposes every step — inputs, computed
            signals, the exact prompt sent, raw model output, parse errors, and
            timings. Use the{" "}
            <span className="text-gray-900 dark:text-neutral-100 font-medium">
              Force
            </span>{" "}
            dropdown to trigger failure modes.
          </div>
        </div>

        {/* Center column: decision + description */}
        <div className="lg:col-span-5 space-y-4">
          {!customOpen && (
            <div className="border border-gray-200 dark:border-neutral-800 rounded-lg p-5 bg-white dark:bg-neutral-950">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-neutral-100">
                    {selected.label}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-neutral-400 mt-1 leading-relaxed">
                    {selected.blurb}
                  </div>
                </div>
                <Badge tone="gray">{selected.id}</Badge>
              </div>
              <div className="mt-4">
                <div className="text-xs text-gray-500 dark:text-neutral-500 mb-1 font-medium">
                  proposed action
                </div>
                <div className="text-sm text-gray-800 dark:text-neutral-200">
                  {selected.action.summary}
                </div>
                <div className="flex gap-2 mt-2.5 flex-wrap">
                  <Badge tone={selected.action.reversible ? "green" : "red"}>
                    {selected.action.reversible
                      ? "reversible"
                      : "irreversible"}
                  </Badge>
                  <Badge
                    tone={selected.action.externallyVisible ? "amber" : "blue"}
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

      <footer className="max-w-[1400px] mx-auto px-6 py-10 text-xs text-gray-500 dark:text-neutral-600 text-center border-t border-gray-100 dark:border-neutral-900 mt-8">
        alfred_ take-home prototype · decision pipeline only — no tools are
        actually executed
      </footer>
    </main>
  );
}
