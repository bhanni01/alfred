import type {
  Action,
  ComputedSignals,
  Context,
  Decision,
  PipelineOptions,
  Trace,
} from "./types";
import { computeSignals } from "./signals";
import { describePolicyRule } from "./policy";
import { buildPrompt } from "./prompt";
import { callLlm, shouldUseMock } from "./llm";
import { ModelOutputSchema } from "./schema";

// The orchestrator. Every decision — silent, confirm, refuse, fallback —
// leaves through this function, and every branch populates a Trace so the UI
// can render "under the hood" for all cases.

export async function runPipeline(
  action: Action,
  context: Context,
  opts: PipelineOptions,
): Promise<Trace> {
  const tStart = Date.now();
  const effectiveMock = opts.mock || shouldUseMock();

  // --- Step 1: forced missing-context injection (for demo) ---
  // Applied BEFORE signals so the signals layer notices. Strips the action's
  // first required param (whatever the action kind is), so the demo works
  // regardless of scenario.
  let effectiveAction = action;
  if (opts.forcedFailure === "missing-context") {
    const requiredByKind: Record<string, string[]> = {
      send_email: ["to_email", "subject", "body"],
      reply_email: ["to_email", "body"],
      transfer_funds: ["from", "to", "amount_usd"],
      create_calendar_event: ["title", "start", "attendees"],
      delete_file: ["path"],
      run_shell: ["cmd"],
    };
    const paramsToNull = requiredByKind[action.kind] ?? Object.keys(action.params);
    const nulled: Record<string, unknown> = { ...action.params };
    for (const p of paramsToNull) nulled[p] = null;
    effectiveAction = { ...action, params: nulled };
  }

  // --- Step 2: compute signals (deterministic) ---
  const tSignals0 = Date.now();
  let signals = computeSignals(effectiveAction, context);
  const signalsMs = Date.now() - tSignals0;

  // Forced policy violation demo
  if (opts.forcedFailure === "policy-violation") {
    signals = {
      ...signals,
      policyViolation: "demo.forced_refuse",
      notes: [...signals.notes, "policyViolation forced for demo"],
    };
  }

  // --- Step 3: policy short-circuit ---
  if (signals.policyViolation) {
    const decision: Decision = {
      verdict: "REFUSE",
      rationale: `Policy rule "${signals.policyViolation}" matched. ${describePolicyRule(signals.policyViolation)}`,
      userMessage: `I can't do that — it's blocked by policy rule "${signals.policyViolation}". You'll need a human to handle this.`,
      confidence: 1.0,
      fallback: false,
    };
    return {
      action: effectiveAction,
      context,
      signals,
      shortCircuit: {
        by: "policy",
        reason: `${signals.policyViolation}: ${describePolicyRule(signals.policyViolation)}`,
      },
      forcedFailure: opts.forcedFailure,
      mock: effectiveMock,
      decision,
      timings: { signalsMs, totalMs: Date.now() - tStart },
    };
  }

  // --- Step 4: missing context / ambiguity short-circuit ---
  if (signals.missingCriticalParams.length > 0 || signals.entityAmbiguity.length > 0) {
    const question = clarifyQuestion(effectiveAction, signals);
    const decision: Decision = {
      verdict: "CLARIFY",
      rationale:
        signals.missingCriticalParams.length > 0
          ? `Missing critical param(s): ${signals.missingCriticalParams.join(", ")}.`
          : `Entity ambiguity: ${signals.entityAmbiguity.join(", ")}.`,
      userMessage: question,
      confidence: 1.0,
      fallback: false,
    };
    return {
      action: effectiveAction,
      context,
      signals,
      shortCircuit: {
        by: "missing-context",
        reason:
          signals.missingCriticalParams.length > 0
            ? `missing: ${signals.missingCriticalParams.join(", ")}`
            : `ambiguous: ${signals.entityAmbiguity.join(", ")}`,
      },
      forcedFailure: opts.forcedFailure,
      mock: effectiveMock,
      decision,
      timings: { signalsMs, totalMs: Date.now() - tStart },
    };
  }

  // --- Step 5: revocation short-circuit ---
  // This is the Acme guardrail — deterministic, not LLM-dependent.
  // If we have an unresolved revocation and the user only offered a bare
  // affirmation as the latest turn, we force CONFIRM.
  if (signals.revocationUnresolved && signals.hasConfirmationToken) {
    const pending = context.pendingAction;
    const reason = pending?.reason ?? "the earlier hold";
    const decision: Decision = {
      verdict: "CONFIRM",
      rationale: `Latest message is an affirmation, but history contains an unresolved hold — "${reason}" — that was never explicitly cleared. Treating bare "yes" as insufficient consent on an unretracted pause.`,
      userMessage: `Quick check before I proceed: earlier you said "${reason}". Has that been resolved? If yes, confirm and I'll ${effectiveAction.summary.toLowerCase()}`,
      confidence: 0.95,
      fallback: false,
    };
    return {
      action: effectiveAction,
      context,
      signals,
      shortCircuit: {
        by: "revocation",
        reason: `unresolved hold: "${reason}"`,
      },
      forcedFailure: opts.forcedFailure,
      mock: effectiveMock,
      decision,
      timings: { signalsMs, totalMs: Date.now() - tStart },
    };
  }

  // --- Step 6: build prompt ---
  const prompt = buildPrompt(effectiveAction, context, signals);

  // --- Step 7 + 8: call LLM with timeout + parse (with 1 retry on malformed) ---
  const tLlm0 = Date.now();
  let retried = false;
  let parseError: string | undefined;
  let rawFirst: Trace["raw"];

  const attempt = async (correction?: string) => {
    const r = await callLlm(effectiveAction, context, signals, prompt, {
      forcedFailure: opts.forcedFailure,
      mock: effectiveMock,
      retryCorrection: correction,
    });
    return r;
  };

  try {
    const r1 = await attempt();
    rawFirst = r1.raw;
    const parsed1 = ModelOutputSchema.safeParse(r1.toolInput);
    if (parsed1.success) {
      const decision: Decision = { ...parsed1.data, fallback: false };
      return {
        action: effectiveAction,
        context,
        signals,
        prompt,
        raw: r1.raw,
        forcedFailure: opts.forcedFailure,
        mock: effectiveMock,
        decision,
        timings: {
          signalsMs,
          llmMs: Date.now() - tLlm0,
          totalMs: Date.now() - tStart,
        },
      };
    }

    // Retry once with a corrective turn.
    retried = true;
    parseError = parsed1.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");

    const r2 = await attempt(
      `Your previous emit_decision call did not match the required schema (${parseError}). Emit the tool again with a valid verdict enum and all required fields.`,
    );
    const parsed2 = ModelOutputSchema.safeParse(r2.toolInput);
    if (parsed2.success) {
      const decision: Decision = { ...parsed2.data, fallback: false };
      return {
        action: effectiveAction,
        context,
        signals,
        prompt,
        raw: r2.raw,
        retried: true,
        parseError,
        forcedFailure: opts.forcedFailure,
        mock: effectiveMock,
        decision,
        timings: {
          signalsMs,
          llmMs: Date.now() - tLlm0,
          totalMs: Date.now() - tStart,
        },
      };
    }

    // Second malformed — fall through to safe fallback.
    parseError = `retry also malformed: ${parsed2.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")}`;
    return fallbackTrace({
      action: effectiveAction,
      context,
      signals,
      prompt,
      raw: r2.raw,
      retried: true,
      parseError,
      forcedFailure: opts.forcedFailure,
      mock: effectiveMock,
      signalsMs,
      llmMs: Date.now() - tLlm0,
      tStart,
    });
  } catch (e: any) {
    const msg =
      e?.message === "LLM_TIMEOUT"
        ? "timeout"
        : `error: ${e?.message ?? "unknown"}`;
    return fallbackTrace({
      action: effectiveAction,
      context,
      signals,
      prompt,
      raw: rawFirst,
      retried,
      parseError: msg,
      forcedFailure: opts.forcedFailure,
      mock: effectiveMock,
      signalsMs,
      llmMs: Date.now() - tLlm0,
      tStart,
    });
  }
}

// --- Helpers ---

function clarifyQuestion(action: Action, signals: ComputedSignals): string {
  if (signals.entityAmbiguity.includes("recipient")) {
    const toName = (action.params as any).to_name ?? "the recipient";
    return `Which ${toName} did you mean? I see multiple matching contacts.`;
  }
  if (signals.missingCriticalParams.length > 0) {
    return `I need a bit more info before I can run this: ${signals.missingCriticalParams.join(", ")}.`;
  }
  return `I need more context before I can run this action.`;
}

function fallbackTrace(args: {
  action: Action;
  context: Context;
  signals: ComputedSignals;
  prompt: ReturnType<typeof buildPrompt>;
  raw: Trace["raw"];
  retried: boolean;
  parseError?: string;
  forcedFailure: Trace["forcedFailure"];
  mock: boolean;
  signalsMs: number;
  llmMs: number;
  tStart: number;
}): Trace {
  const irreversibleOrExternal =
    args.action.reversible === false ||
    args.action.externallyVisible === true ||
    args.signals.externalVisibility === "external";

  const decision: Decision = irreversibleOrExternal
    ? {
        verdict: "CONFIRM",
        rationale: `Model unavailable or unparseable (${args.parseError ?? "unknown"}). Action is irreversible or externally visible, so defaulting to CONFIRM rather than execute.`,
        userMessage: `I couldn't reason confidently about this just now. Before I ${args.action.summary.toLowerCase()}, can you confirm?`,
        confidence: 0.3,
        fallback: true,
      }
    : {
        verdict: "CLARIFY",
        rationale: `Model unavailable or unparseable (${args.parseError ?? "unknown"}). Action is reversible and internal, but I can't reason about intent confidently right now.`,
        userMessage: `I'm having trouble reasoning about this right now — can you restate what you'd like me to do?`,
        confidence: 0.3,
        fallback: true,
      };

  return {
    action: args.action,
    context: args.context,
    signals: args.signals,
    prompt: args.prompt,
    raw: args.raw,
    retried: args.retried,
    parseError: args.parseError,
    forcedFailure: args.forcedFailure,
    mock: args.mock,
    decision,
    timings: {
      signalsMs: args.signalsMs,
      llmMs: args.llmMs,
      totalMs: Date.now() - args.tStart,
    },
  };
}
