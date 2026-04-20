// Smoke test: hit /api/decide for each scenario and each forced-failure mode.
// Uses mock LLM so no API key is burned.
//
// Usage:
//   FORCE_MOCK=1 npm run start -- -p 3031 &
//   npx tsx scripts/smoke.ts

import { SCENARIOS } from "../lib/scenarios";
import type { Trace, ForcedFailure } from "../lib/types";

const BASE = process.env.BASE ?? "http://localhost:3031";

const RED = "\x1b[31m";
const GRN = "\x1b[32m";
const YEL = "\x1b[33m";
const DIM = "\x1b[2m";
const RST = "\x1b[0m";

async function hit(body: unknown): Promise<Trace> {
  const res = await fetch(`${BASE}/api/decide`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  return data as Trace;
}

let pass = 0;
let fail = 0;

async function checkVerdict(label: string, body: unknown, want: string) {
  const t = await hit(body);
  const got = t.decision.verdict;
  const ok = got === want;
  const extra = t.shortCircuit
    ? ` ${DIM}[short-circuit: ${t.shortCircuit.by}]${RST}`
    : t.decision.fallback
      ? ` ${YEL}[fallback]${RST}`
      : "";
  console.log(
    `  ${ok ? GRN + "PASS" + RST : RED + "FAIL" + RST}  ${label.padEnd(54)} want=${want} got=${got}${extra}`,
  );
  if (!ok) {
    console.log(`        ${t.decision.rationale.slice(0, 140)}`);
    fail++;
  } else pass++;
}

async function checkFallback(label: string, body: unknown) {
  const t = await hit(body);
  const ok = t.decision.fallback === true;
  console.log(
    `  ${ok ? GRN + "PASS" + RST : RED + "FAIL" + RST}  ${label.padEnd(54)} fallback=${t.decision.fallback} verdict=${t.decision.verdict}${t.retried ? " [retried]" : ""}`,
  );
  if (!ok) fail++;
  else pass++;
}

async function checkShortCircuit(
  label: string,
  body: unknown,
  expectBy: string,
) {
  const t = await hit(body);
  const ok = t.shortCircuit?.by === expectBy;
  console.log(
    `  ${ok ? GRN + "PASS" + RST : RED + "FAIL" + RST}  ${label.padEnd(54)} shortCircuit.by=${t.shortCircuit?.by ?? "none"} (want ${expectBy})`,
  );
  if (!ok) fail++;
  else pass++;
}

(async () => {
  console.log("\nSmoke — 6 scenarios (mock LLM)");
  for (const s of SCENARIOS) {
    await checkVerdict(
      s.label,
      { action: s.action, context: s.context, forcedFailure: "none" as ForcedFailure, mock: true },
      s.expectedVerdict,
    );
  }

  const s1 = SCENARIOS[0];

  console.log("\nSmoke — forced failure modes on scenario #1 (mock LLM)");
  await checkFallback("timeout → safe fallback", {
    action: s1.action,
    context: s1.context,
    forcedFailure: "timeout" as ForcedFailure,
    mock: true,
  });
  await checkFallback("malformed → retry → safe fallback", {
    action: s1.action,
    context: s1.context,
    forcedFailure: "malformed" as ForcedFailure,
    mock: true,
  });
  await checkShortCircuit(
    "missing-context → CLARIFY short-circuit",
    {
      action: s1.action,
      context: s1.context,
      forcedFailure: "missing-context" as ForcedFailure,
      mock: true,
    },
    "missing-context",
  );
  await checkShortCircuit(
    "policy-violation → REFUSE short-circuit",
    {
      action: s1.action,
      context: s1.context,
      forcedFailure: "policy-violation" as ForcedFailure,
      mock: true,
    },
    "policy",
  );

  console.log(`\n${pass} pass · ${fail} fail\n`);
  process.exit(fail > 0 ? 1 : 0);
})();
