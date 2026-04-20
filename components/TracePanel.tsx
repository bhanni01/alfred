"use client";

import type { Trace, ComputedSignals } from "@/lib/types";
import { Badge, CopyButton, JSONView, Section } from "./ui";

export function TracePanel({ trace }: { trace: Trace | null }) {
  if (!trace) {
    return (
      <div className="text-xs text-neutral-500 p-3 border border-neutral-800 rounded bg-neutral-950/40">
        Trace will appear here after a run.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
        Under the hood
      </div>

      <Section
        title="1. Inputs"
        subtitle="action + context as received"
        defaultOpen={false}
      >
        <div className="space-y-3">
          <div>
            <div className="text-xs text-neutral-500 mb-1">action</div>
            <JSONView value={trace.action} />
          </div>
          <div>
            <div className="text-xs text-neutral-500 mb-1">context</div>
            <JSONView value={trace.context} />
          </div>
        </div>
      </Section>

      <Section
        title="2. Computed signals"
        subtitle="deterministic"
        defaultOpen={true}
      >
        <SignalsTable signals={trace.signals} />
        {trace.signals.notes.length > 0 && (
          <div className="mt-3">
            <div className="text-xs text-neutral-500 mb-1">notes</div>
            <ul className="list-disc list-inside text-xs text-neutral-400 space-y-1">
              {trace.signals.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {trace.shortCircuit && (
        <Section
          title={`3. Short-circuit — ${trace.shortCircuit.by}`}
          subtitle="LLM never called"
          defaultOpen={true}
        >
          <div className="text-xs text-neutral-400">
            <span className="text-neutral-200 font-medium">
              {trace.shortCircuit.by}:
            </span>{" "}
            {trace.shortCircuit.reason}
          </div>
        </Section>
      )}

      {trace.prompt && (
        <Section
          title="4. Prompt sent to LLM"
          subtitle={`model: ${trace.prompt.model} · tool: ${trace.prompt.toolName}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <CopyButton
              text={`# SYSTEM\n\n${trace.prompt.system}\n\n---\n\n# USER\n\n${trace.prompt.user}`}
              label="copy both"
            />
          </div>
          <div className="text-xs text-neutral-500 mb-1">system</div>
          <pre className="text-xs bg-neutral-950 border border-neutral-800 rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap break-words">
            {trace.prompt.system}
          </pre>
          <div className="text-xs text-neutral-500 mb-1 mt-3">user</div>
          <pre className="text-xs bg-neutral-950 border border-neutral-800 rounded p-3 overflow-auto max-h-96 whitespace-pre-wrap break-words">
            {trace.prompt.user}
          </pre>
        </Section>
      )}

      {trace.raw && (
        <Section
          title="5. Raw model output"
          subtitle={`${trace.raw.latencyMs}ms${
            trace.raw.usage
              ? ` · in ${trace.raw.usage.input_tokens}t · out ${trace.raw.usage.output_tokens}t${
                  trace.raw.usage.cache_read_input_tokens
                    ? ` · cache_read ${trace.raw.usage.cache_read_input_tokens}t`
                    : ""
                }`
              : ""
          }`}
        >
          <div className="text-xs text-neutral-500 mb-1">toolInput</div>
          <JSONView value={trace.raw.toolInput} />
          <div className="text-xs text-neutral-500 mb-1 mt-3">full response</div>
          <JSONView value={trace.raw.raw} />
        </Section>
      )}

      {(trace.parseError || trace.retried) && (
        <Section
          title="6. Parse errors / retries"
          subtitle={trace.retried ? "retried once" : "no retry"}
          defaultOpen={true}
        >
          <div className="text-xs text-neutral-300">
            {trace.parseError ?? "no error recorded"}
          </div>
        </Section>
      )}

      <Section title="7. Parsed decision" defaultOpen={false}>
        <JSONView value={trace.decision} />
      </Section>

      <Section
        title="8. Timings"
        subtitle={`${trace.timings.totalMs}ms total`}
        defaultOpen={false}
      >
        <div className="text-xs text-neutral-400 space-y-1">
          <div>signals: {trace.timings.signalsMs}ms</div>
          {typeof trace.timings.llmMs === "number" && (
            <div>llm: {trace.timings.llmMs}ms</div>
          )}
          <div>total: {trace.timings.totalMs}ms</div>
        </div>
      </Section>

      <div className="text-xs text-neutral-500 mt-2 flex gap-2 flex-wrap">
        {trace.mock && <Badge tone="indigo">mock: true</Badge>}
        <Badge tone="gray">
          forcedFailure: {trace.forcedFailure}
        </Badge>
      </div>
    </div>
  );
}

function SignalsTable({ signals }: { signals: ComputedSignals }) {
  const rows: Array<[string, React.ReactNode]> = [
    ["riskTier", <Badge tone={riskTone(signals.riskTier)}>{signals.riskTier}</Badge>],
    ["reversibility", signals.reversibility],
    ["externalVisibility", signals.externalVisibility],
    [
      "hasConfirmationToken",
      <Badge tone={signals.hasConfirmationToken ? "blue" : "gray"}>
        {String(signals.hasConfirmationToken)}
      </Badge>,
    ],
    [
      "hasRevocationInHistory",
      <Badge tone={signals.hasRevocationInHistory ? "amber" : "gray"}>
        {String(signals.hasRevocationInHistory)}
      </Badge>,
    ],
    [
      "revocationUnresolved",
      <Badge tone={signals.revocationUnresolved ? "red" : "gray"}>
        {String(signals.revocationUnresolved)}
      </Badge>,
    ],
    [
      "entityAmbiguity",
      signals.entityAmbiguity.length
        ? signals.entityAmbiguity.join(", ")
        : <span className="text-neutral-500">none</span>,
    ],
    [
      "missingCriticalParams",
      signals.missingCriticalParams.length
        ? signals.missingCriticalParams.join(", ")
        : <span className="text-neutral-500">none</span>,
    ],
    [
      "policyViolation",
      signals.policyViolation ? (
        <Badge tone="red">{signals.policyViolation}</Badge>
      ) : (
        <span className="text-neutral-500">none</span>
      ),
    ],
    ["staleness", signals.staleness],
  ];

  return (
    <table className="w-full text-xs">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-neutral-900 last:border-0">
            <td className="py-1.5 pr-3 text-neutral-500 font-mono whitespace-nowrap align-top">
              {k}
            </td>
            <td className="py-1.5 text-neutral-200">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function riskTone(tier: ComputedSignals["riskTier"]) {
  switch (tier) {
    case "low":
      return "green" as const;
    case "medium":
      return "blue" as const;
    case "high":
      return "amber" as const;
    case "critical":
      return "red" as const;
  }
}
