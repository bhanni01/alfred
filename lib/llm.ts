import Anthropic from "@anthropic-ai/sdk";
import type {
  Action,
  ComputedSignals,
  Context,
  ForcedFailure,
  PromptPayload,
  RawModelOutput,
} from "./types";
import { DECISION_TOOL } from "./prompt";
import { callMock } from "./mock";

export const LLM_TIMEOUT_MS = 11_000;

export interface CallLlmOptions {
  forcedFailure: ForcedFailure;
  mock: boolean;
  retryCorrection?: string;
}

export interface CallLlmResult {
  raw: RawModelOutput;
  toolInput: unknown; // unvalidated — pipeline zod-parses
}

function haveRealKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && !process.env.FORCE_MOCK;
}

export function shouldUseMock(requestedMock?: boolean): boolean {
  if (requestedMock === true) return true;
  if (process.env.FORCE_MOCK === "1") return true;
  if (!process.env.ANTHROPIC_API_KEY) return true;
  return false;
}

export async function callLlm(
  action: Action,
  context: Context,
  signals: ComputedSignals,
  prompt: PromptPayload,
  opts: CallLlmOptions,
): Promise<CallLlmResult> {
  if (opts.mock) {
    const r = await withTimeout(
      callMock(action, context, signals, prompt, {
        forcedFailure: opts.forcedFailure,
      }),
      LLM_TIMEOUT_MS,
    );
    return { raw: r.raw, toolInput: r.parsed };
  }

  if (opts.forcedFailure === "timeout") {
    // Don't actually call the API — just race against the timer.
    await withTimeout(new Promise<never>(() => {}), 1);
    // unreachable
    throw new Error("LLM_TIMEOUT");
  }

  if (opts.forcedFailure === "malformed") {
    // Don't burn tokens just to demo malformed-parse. Return a malformed
    // shape directly so the pipeline exercises the retry + fallback path.
    const t0 = Date.now();
    return {
      raw: {
        raw: { content: [{ type: "tool_use", name: "emit_decision", input: { verdict: "MAYBE" } }] },
        toolInput: { verdict: "MAYBE" },
        stopReason: "tool_use",
        usage: { input_tokens: 420, output_tokens: 12 },
        latencyMs: Date.now() - t0 + 120,
      },
      toolInput: { verdict: "MAYBE" },
    };
  }

  const client = new Anthropic();
  const t0 = Date.now();

  const userMessages = [{ role: "user" as const, content: prompt.user }];
  if (opts.retryCorrection) {
    userMessages.push({
      role: "user" as const,
      content: opts.retryCorrection,
    });
  }

  const call = client.messages.create({
    model: prompt.model,
    max_tokens: prompt.maxTokens,
    // System as an array of blocks so we can attach cache_control.
    system: [
      {
        type: "text",
        text: prompt.system,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [DECISION_TOOL],
    tool_choice: { type: "tool", name: prompt.toolName },
    messages: userMessages,
  });

  const response = await withTimeout(call, LLM_TIMEOUT_MS);
  const latencyMs = Date.now() - t0;

  const toolUseBlock = response.content.find(
    (b: any) => b.type === "tool_use" && b.name === prompt.toolName,
  ) as any;

  const toolInput = toolUseBlock?.input;

  const raw: RawModelOutput = {
    raw: response,
    toolInput,
    stopReason: response.stop_reason ?? undefined,
    usage: response.usage
      ? {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          cache_read_input_tokens: (response.usage as any)
            .cache_read_input_tokens,
          cache_creation_input_tokens: (response.usage as any)
            .cache_creation_input_tokens,
        }
      : undefined,
    latencyMs,
  };

  return { raw, toolInput };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("LLM_TIMEOUT")), ms);
    p.then(
      (v) => {
        clearTimeout(to);
        resolve(v);
      },
      (e) => {
        clearTimeout(to);
        reject(e);
      },
    );
  });
}

export { haveRealKey };
