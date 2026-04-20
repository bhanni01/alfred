// Core type model for the Execution Decision Layer.
// Kept in one file so the shape of Action / Context / Signals / Trace / Decision
// is easy to scan end-to-end.

export type Verdict =
  | "EXECUTE_SILENT"
  | "EXECUTE_AND_NOTIFY"
  | "CONFIRM"
  | "CLARIFY"
  | "REFUSE";

export type RiskTier = "low" | "medium" | "high" | "critical";

export interface Action {
  kind: string; // e.g. "send_email", "transfer_funds", "create_calendar_event"
  params: Record<string, unknown>;
  reversible: boolean;
  externallyVisible: boolean;
  summary: string; // one-line human description
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  ts: number; // epoch ms
}

export interface PendingAction {
  action: Action;
  proposedAt: number;
  status: "awaiting_confirm" | "paused" | "revoked";
  reason?: string;
}

export interface UserState {
  tz?: string;
  role?: string;
  trustedEntities?: string[]; // e.g. internal email domains
  contacts?: Array<{ name: string; email: string }>;
}

export interface Context {
  history: Message[];
  userState?: UserState;
  pendingAction?: PendingAction;
  now?: number; // evaluated "now" timestamp — defaults to Date.now() if omitted
}

export interface ComputedSignals {
  riskTier: RiskTier;
  reversibility: "reversible" | "irreversible";
  externalVisibility: "internal" | "external";
  hasConfirmationToken: boolean;
  hasRevocationInHistory: boolean;
  revocationUnresolved: boolean;
  entityAmbiguity: string[];
  missingCriticalParams: string[];
  policyViolation: string | null;
  staleness: "fresh" | "stale" | "n/a";
  notes: string[];
}

export interface PromptPayload {
  system: string;
  user: string;
  toolName: "emit_decision";
  model: string;
  maxTokens: number;
}

export interface RawModelOutput {
  raw: unknown;
  toolInput?: unknown;
  stopReason?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  latencyMs: number;
}

export interface Decision {
  verdict: Verdict;
  rationale: string;
  userMessage?: string;
  confidence: number;
  fallback: boolean;
}

export type ForcedFailure =
  | "none"
  | "timeout"
  | "malformed"
  | "missing-context"
  | "policy-violation";

export interface PipelineOptions {
  forcedFailure: ForcedFailure;
  mock: boolean;
}

export interface Trace {
  scenarioId?: string;
  action: Action;
  context: Context;
  signals: ComputedSignals;
  shortCircuit?: {
    by: "policy" | "missing-context" | "revocation" | "invalid-input";
    reason: string;
  };
  prompt?: PromptPayload;
  raw?: RawModelOutput;
  parseError?: string;
  retried?: boolean;
  forcedFailure: ForcedFailure;
  mock: boolean;
  decision: Decision;
  timings: { signalsMs: number; llmMs?: number; totalMs: number };
}

export interface Scenario {
  id: string;
  label: string;
  difficulty: "easy" | "ambiguous" | "adversarial";
  blurb: string;
  action: Action;
  context: Context;
  expectedVerdict: Verdict;
}
