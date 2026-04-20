import OpenAI from "openai";
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

export function shouldUseMock(requestedMock?: boolean): boolean {
  if (requestedMock === true) return true;
  if (process.env.FORCE_MOCK === "1") return true;
  if (!process.env.OPENAI_API_KEY) return true;
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
    // Don't actually call the API — just race against an immediate-reject timer.
    await withTimeout(new Promise<never>(() => {}), 1);
    throw new Error("LLM_TIMEOUT"); // unreachable
  }

  if (opts.forcedFailure === "malformed") {
    // Don't burn tokens just to demo malformed-parse. Return an unparseable
    // shape directly so the pipeline exercises the retry + fallback path.
    const t0 = Date.now();
    return {
      raw: {
        raw: {
          choices: [
            { message: { content: '{"verdict":"MAYBE"}', role: "assistant" } },
          ],
        },
        toolInput: { verdict: "MAYBE" },
        stopReason: "stop",
        usage: { input_tokens: 420, output_tokens: 12 },
        latencyMs: Date.now() - t0 + 120,
      },
      toolInput: { verdict: "MAYBE" },
    };
  }

  const client = new OpenAI();
  const t0 = Date.now();

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user },
  ];
  if (opts.retryCorrection) {
    messages.push({ role: "user", content: opts.retryCorrection });
  }

  const call = client.chat.completions.create({
    model: prompt.model,
    max_tokens: prompt.maxTokens,
    temperature: 0.2,
    messages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: DECISION_TOOL.name,
        schema: DECISION_TOOL.schema,
        strict: true,
      },
    },
  });

  const response = await withTimeout(call, LLM_TIMEOUT_MS);
  const latencyMs = Date.now() - t0;

  const content = response.choices[0]?.message?.content ?? "";
  const refusal = (response.choices[0]?.message as any)?.refusal as
    | string
    | null
    | undefined;

  let toolInput: unknown = null;
  if (!refusal && content) {
    try {
      toolInput = JSON.parse(content);
    } catch {
      toolInput = { _parse_error: "content was not valid JSON", content };
    }
  } else if (refusal) {
    toolInput = { _refusal: refusal };
  }

  const raw: RawModelOutput = {
    raw: response,
    toolInput,
    stopReason: response.choices[0]?.finish_reason ?? undefined,
    usage: response.usage
      ? {
          input_tokens: response.usage.prompt_tokens,
          output_tokens: response.usage.completion_tokens,
          cache_read_input_tokens: (response.usage.prompt_tokens_details as any)
            ?.cached_tokens,
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
