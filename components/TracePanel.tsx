"use client";

import type { Trace, ComputedSignals } from "@/lib/types";
import { Badge, CopyButton, JSONView, Section } from "./ui";

export function TracePanel({ trace }: { trace: Trace | null }) {
  if (!trace) {
    return (
      <div className="text-xs text-gray-500 p-4 border border-gray-200 rounded-lg bg-gray-50/50">
        Trace will appear here after a run.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-2">
        Under the hood
      </div>

      <Section
        title="1. Inputs"
        subtitle="action + context as received"
        defaultOpen={false}
      >
        <div className="space-y-3">
          <div>
            <div className="text-xs text-gray-500 mb-1 font-medium">action</div>
            <JSONView value={trace.action} />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1 font-medium">context</div>
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
            <div className="text-xs text-gray-500 mb-1 font-medium">notes</div>
            <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
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
          <div className="text-xs text-gray-700">
            <span className="text-gray-900 font-medium">
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
          <div className="text-xs text-gray-500 mb-1 font-medium">system</div>
          <pre className="text-xs bg-gray-50 border border-gray-200 rounded-md p-3 overflow-auto max-h-64 whitespace-pre-wrap break-words text-gray-800">
            {trace.prompt.system}
          </pre>
          <div className="text-xs text-gray-500 mb-1 mt-3 font-medium">user</div>
          <pre className="text-xs bg-gray-50 border border-gray-200 rounded-md p-3 overflow-auto max-h-96 whitespace-pre-wrap break-words text-gray-800">
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
                    ? ` · cached ${trace.raw.usage.cache_read_input_tokens}t`
                    : ""
                }`
              : ""
          }`}
        >
          <div className="text-xs text-gray-500 mb-1 font-medium">
            parsed output
          </div>
          <JSONView value={trace.raw.toolInput} />
          <div className="text-xs text-gray-500 mb-1 mt-3 font-medium">
            full response
          </div>
          <JSONView value={trace.raw.raw} />
        </Section>
      )}

      {(trace.parseError || trace.retried) && (
        <Section
          title="6. Parse errors / retries"
          subtitle={trace.retried ? "retried once" : "no retry"}
          defaultOpen={true}
        >
          <div className="text-xs text-gray-700">
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
        <div className="text-xs text-gray-600 space-y-1">
          <div>signals: {trace.timings.signalsMs}ms</div>
          {typeof trace.timings.llmMs === "number" && (
            <div>llm: {trace.timings.llmMs}ms</div>
          )}
          <div>total: {trace.timings.totalMs}ms</div>
        </div>
      </Section>

      <div className="text-xs text-gray-500 mt-3 flex gap-2 flex-wrap">
        {trace.mock && <Badge tone="indigo">mock: true</Badge>}
        <Badge tone="gray">forcedFailure: {trace.forcedFailure}</Badge>
      </div>
    </div>
  );
}

function SignalsTable({ signals }: { signals: ComputedSignals }) {
  const rows: Array<[string, React.ReactNode]> = [
    [
      "riskTier",
      <Badge tone={riskTone(signals.riskTier)}>{signals.riskTier}</Badge>,
    ],
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
      signals.entityAmbiguity.length ? (
        signals.entityAmbiguity.join(", ")
      ) : (
        <span className="text-gray-400">none</span>
      ),
    ],
    [
      "missingCriticalParams",
      signals.missingCriticalParams.length ? (
        signals.missingCriticalParams.join(", ")
      ) : (
        <span className="text-gray-400">none</span>
      ),
    ],
    [
      "policyViolation",
      signals.policyViolation ? (
        <Badge tone="red">{signals.policyViolation}</Badge>
      ) : (
        <span className="text-gray-400">none</span>
      ),
    ],
    ["staleness", signals.staleness],
  ];

  return (
    <table className="w-full text-xs">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-gray-100 last:border-0">
            <td className="py-2 pr-3 text-gray-500 font-mono whitespace-nowrap align-top">
              {k}
            </td>
            <td className="py-2 text-gray-800">{v}</td>
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
