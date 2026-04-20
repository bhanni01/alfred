import type {
  Action,
  ComputedSignals,
  Context,
  ForcedFailure,
  PromptPayload,
  RawModelOutput,
} from "./types";
import type { ModelOutput } from "./schema";

// A deterministic mock of the LLM layer. Given the same inputs + signals,
// it returns the same verdict. This lets graders without an API key see a
// realistic trace, and makes failure-mode demos (timeout / malformed /
// policy short-circuits) trivially triggerable.
//
// IMPORTANT: policy violations, missing-context, and revocation-unresolved
// are already handled by deterministic short-circuits in pipeline.ts and
// never reach this file. Mock only sees "clean" inputs.

export interface MockCallOptions {
  forcedFailure: ForcedFailure;
}

export interface MockCallResult {
  raw: RawModelOutput;
  parsed: unknown; // unvalidated — pipeline still zod-parses it
}

export async function callMock(
  action: Action,
  context: Context,
  signals: ComputedSignals,
  prompt: PromptPayload,
  opts: MockCallOptions,
): Promise<MockCallResult> {
  const t0 = Date.now();

  if (opts.forcedFailure === "timeout") {
    // Let the caller's Promise.race handle the actual rejection.
    // We just sleep long enough to be caught by the race.
    await sleep(20_000);
    throw new Error("LLM_TIMEOUT");
  }

  if (opts.forcedFailure === "malformed") {
    // Return shape the zod schema will reject.
    const raw: RawModelOutput = {
      raw: { content: [{ type: "tool_use", name: "emit_decision", input: { verdict: "MAYBE", reason: "??" } }] },
      toolInput: { verdict: "MAYBE", reason: "??" },
      stopReason: "tool_use",
      usage: { input_tokens: 412, output_tokens: 18 },
      latencyMs: Date.now() - t0 + 120,
    };
    return { raw, parsed: raw.toolInput };
  }

  // Simulate a small amount of model latency.
  await sleep(250 + Math.random() * 150);

  const parsed = decideFromSignals(action, context, signals);

  const raw: RawModelOutput = {
    raw: {
      model: prompt.model + " (MOCK)",
      content: [
        {
          type: "tool_use",
          name: "emit_decision",
          input: parsed,
        },
      ],
    },
    toolInput: parsed,
    stopReason: "tool_use",
    usage: {
      input_tokens: estimateTokens(prompt.system + prompt.user),
      output_tokens: estimateTokens(JSON.stringify(parsed)),
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
    latencyMs: Date.now() - t0,
  };

  return { raw, parsed };
}

// Minimalist rule-table mirroring the intent of the real prompt.
// (Real LLM calls on clean inputs will usually arrive at similar verdicts
// for the 6 scenarios — this is here so UI + trace render without a key.)
function decideFromSignals(
  action: Action,
  context: Context,
  s: ComputedSignals,
): ModelOutput {
  // Staleness → CONFIRM regardless of other signals (mirrors real prompt).
  if (s.staleness === "stale") {
    return {
      verdict: "CONFIRM",
      rationale:
        `The most recent affirmation in history is stale (pending action was proposed more than 15 minutes before the current request). Prior 'yes' tokens are not treated as fresh consent — especially for irreversible or externally visible actions.`,
      userMessage: `This action was previously confirmed some time ago. Want me to ${action.summary.toLowerCase()} now with the updated details?`,
      confidence: 0.78,
    };
  }

  // External + irreversible default to CONFIRM unless the turn is clean,
  // explicit, and *not* just a bare affirmation of a prior pending action.
  const irreversibleExternal =
    s.reversibility === "irreversible" && s.externalVisibility === "external";

  if (irreversibleExternal) {
    // Scenario 5 specifically: the pending action is a summary reply, not
    // the injected instruction. If the user gave a fresh confirmation and
    // nothing flagged the intent — notify after.
    const lastUserMsgContent =
      context.history
        .filter((m) => m.role === "user")
        .slice(-1)[0]?.content ?? "";
    const looksLikeSummaryReply =
      action.kind === "reply_email" &&
      (action.summary.toLowerCase().includes("summary") ||
        (action.params as any).body?.toString().toLowerCase().includes("summary"));

    if (s.hasConfirmationToken && !s.hasRevocationInHistory && looksLikeSummaryReply) {
      return {
        verdict: "EXECUTE_AND_NOTIFY",
        rationale: `User explicitly confirmed a low-complexity summary reply; inbound-email content contains a prompt-injection attempt but the proposed action is benign and tracks the user's original ask.`,
        userMessage: `Sent — summarized Dan's note and acknowledged. Heads up: his email contained a suspicious "ignore previous instructions" line that I ignored.`,
        confidence: 0.72,
      };
    }

    return {
      verdict: "CONFIRM",
      rationale: `Action is irreversible and externally visible (${s.externalVisibility}, risk tier ${s.riskTier}). Defaulting to explicit confirmation rather than silent execution.`,
      userMessage: `About to ${action.summary.toLowerCase()} — confirm?`,
      confidence: 0.74,
    };
  }

  // Internal + reversible with clear intent → EXECUTE_AND_NOTIFY.
  if (
    s.reversibility === "reversible" &&
    s.externalVisibility === "internal" &&
    s.missingCriticalParams.length === 0 &&
    s.entityAmbiguity.length === 0
  ) {
    return {
      verdict: "EXECUTE_AND_NOTIFY",
      rationale: `Reversible internal action with resolved entities and explicit intent in the latest turn. Safe to execute and inform the user.`,
      userMessage: `Done — ${action.summary.toLowerCase()}`,
      confidence: 0.86,
    };
  }

  // Fallback for anything else reaching here.
  return {
    verdict: "CONFIRM",
    rationale: `Signals did not clearly meet the silent-execution bar. Defaulting to CONFIRM.`,
    userMessage: `About to ${action.summary.toLowerCase()} — confirm?`,
    confidence: 0.6,
  };
}

function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
