import type {
  Action,
  ComputedSignals,
  Context,
  Message,
  RiskTier,
} from "./types";
import { evaluatePolicy } from "./policy";

// ---------- Per-kind metadata ----------
//
// What required params each action kind expects. If a required param is
// absent or null/empty, it goes into `missingCriticalParams`.
const REQUIRED_PARAMS: Record<string, string[]> = {
  send_email: ["to_email", "subject", "body"],
  reply_email: ["to_email", "body"],
  transfer_funds: ["from", "to", "amount_usd"],
  create_calendar_event: ["title", "start", "attendees"],
  delete_file: ["path"],
  run_shell: ["cmd"],
};

// Base risk tier by kind. Some kinds are bumped higher by param thresholds
// or external visibility — see below.
const BASE_RISK: Record<string, RiskTier> = {
  create_calendar_event: "low",
  add_note: "low",
  send_email: "medium",
  reply_email: "medium",
  delete_file: "high",
  transfer_funds: "high",
  run_shell: "high",
};

const AFFIRMATION_TOKENS = [
  "yes",
  "yep",
  "yeah",
  "yup",
  "y",
  "ok",
  "okay",
  "sure",
  "do it",
  "go ahead",
  "send it",
  "send",
  "ship it",
  "confirmed",
  "confirm",
  "approve",
  "approved",
  "lgtm",
  "proceed",
];

const REVOCATION_PATTERNS = [
  /\bhold off\b/i,
  /\bhold on\b/i,
  /\bhold\b/i,
  /\bwait\b/i,
  /\bpause\b/i,
  /\bdon'?t\b/i,
  /\bstop\b/i,
  /\bnot yet\b/i,
  /\bcancel\b/i,
  /\babort\b/i,
  /\bnevermind\b/i,
  /\bnever mind\b/i,
  /\bhold up\b/i,
  /\bon second thought\b/i,
];

const RESUMPTION_PATTERNS = [
  /\blegal (has )?(approved|signed off|cleared)\b/i,
  /\bapproved by legal\b/i,
  /\bcleared\b/i,
  /\boverride\b/i,
  /\bignore (the )?(previous )?hold\b/i,
  /\bdisregard (the )?(previous )?hold\b/i,
  /\bresume\b/i,
  /\bgo ahead now\b/i,
  /\bgreen ?light\b/i,
];

// ---------- Small helpers ----------

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[.!?,]+$/g, "");
}

function isAffirmation(message: string): boolean {
  const n = normalize(message);
  if (AFFIRMATION_TOKENS.includes(n)) return true;
  // short phrases like "yes please", "yep send it", "ok do it"
  if (n.length <= 30) {
    return AFFIRMATION_TOKENS.some(
      (tok) =>
        n === tok ||
        n.startsWith(tok + " ") ||
        n.endsWith(" " + tok) ||
        n.includes(" " + tok + " "),
    );
  }
  return false;
}

function messageMatchesAny(msg: Message, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(msg.content));
}

function domainOf(email: string | null | undefined): string | null {
  if (!email || typeof email !== "string") return null;
  const at = email.indexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : null;
}

// ---------- Signal computation ----------

export function computeSignals(
  action: Action,
  context: Context,
): ComputedSignals {
  const notes: string[] = [];
  const history = context.history ?? [];
  const now = context.now ?? Date.now();

  // --- missing params ---
  const required = REQUIRED_PARAMS[action.kind] ?? [];
  const missingCriticalParams = required.filter((p) => {
    const v = (action.params as Record<string, unknown>)[p];
    return v === undefined || v === null || v === "";
  });
  if (missingCriticalParams.length) {
    notes.push(`missing params: ${missingCriticalParams.join(", ")}`);
  }

  // --- entity ambiguity ---
  // Currently handles the "to_name resolves to multiple contacts" case, plus
  // the more general "to_name set but to_email null".
  const entityAmbiguity: string[] = [];
  const toName = (action.params as any).to_name as string | undefined;
  const toEmail = (action.params as any).to_email as string | undefined | null;
  const contacts = context.userState?.contacts ?? [];
  if (toName && (!toEmail || toEmail === null)) {
    const matches = contacts.filter((c) =>
      c.name.toLowerCase().includes(toName.toLowerCase()),
    );
    if (matches.length > 1) {
      entityAmbiguity.push("recipient");
      notes.push(
        `recipient "${toName}" matches ${matches.length} contacts: ${matches
          .map((m) => m.email)
          .join(", ")}`,
      );
    } else if (matches.length === 0 && !toEmail) {
      // name given but no matching contact — missing, not ambiguous
      if (!missingCriticalParams.includes("to_email"))
        missingCriticalParams.push("to_email");
    }
  }

  // --- external visibility ---
  const trusted = new Set(
    (context.userState?.trustedEntities ?? []).map((d) => d.toLowerCase()),
  );
  const recipientDomain = domainOf(toEmail ?? null);
  const externalByDomain = recipientDomain
    ? !trusted.has(recipientDomain)
    : false;
  const externalVisibility: ComputedSignals["externalVisibility"] =
    action.externallyVisible || externalByDomain ? "external" : "internal";
  if (externalByDomain && !action.externallyVisible) {
    notes.push(`recipient domain "${recipientDomain}" not in trustedEntities`);
  }

  // --- risk tier ---
  let riskTier: RiskTier = BASE_RISK[action.kind] ?? "medium";
  const amount = (action.params as any).amount_usd as number | undefined;
  if (action.kind === "transfer_funds") {
    if (typeof amount === "number") {
      if (amount > 10_000) riskTier = "critical";
      else if (amount > 1_000) riskTier = "high";
      else riskTier = "medium";
    }
  }
  if (externalVisibility === "external" && riskTier === "low") {
    riskTier = "medium";
    notes.push("bumped risk low→medium: externally visible");
  } else if (externalVisibility === "external" && riskTier === "medium") {
    riskTier = "high";
    notes.push("bumped risk medium→high: externally visible");
  }

  // --- reversibility ---
  const reversibility: ComputedSignals["reversibility"] = action.reversible
    ? "reversible"
    : "irreversible";

  // --- revocation / confirmation / staleness ---
  const pending = context.pendingAction;
  let hasConfirmationToken = false;
  let hasRevocationInHistory = false;
  let revocationUnresolved = false;
  let staleness: ComputedSignals["staleness"] = "n/a";

  const latest = history[history.length - 1];
  if (latest && latest.role === "user" && isAffirmation(latest.content)) {
    hasConfirmationToken = true;
    notes.push(`latest user message is an affirmation: "${latest.content}"`);
  }

  if (pending) {
    const revAfterPending = history
      .filter((m) => m.role === "user" && m.ts >= pending.proposedAt)
      .filter((m) => messageMatchesAny(m, REVOCATION_PATTERNS));
    if (revAfterPending.length > 0) {
      hasRevocationInHistory = true;
      const latestRev = revAfterPending[revAfterPending.length - 1];
      // Any subsequent user message explicitly resuming the revocation?
      const resumption = history
        .filter((m) => m.role === "user" && m.ts > latestRev.ts)
        .some((m) => messageMatchesAny(m, RESUMPTION_PATTERNS));
      if (!resumption) {
        revocationUnresolved = true;
        notes.push(
          `unresolved revocation: user said "${latestRev.content}" at t=${latestRev.ts} and never explicitly cleared it`,
        );
      } else {
        notes.push("revocation was explicitly cleared later");
      }
    }

    // Staleness — proposal older than 15 min counts as stale.
    const ageMin = (now - pending.proposedAt) / 60_000;
    staleness = ageMin > 15 ? "stale" : "fresh";
    if (staleness === "stale") {
      notes.push(
        `pending action is stale (${Math.round(ageMin)} min since proposal)`,
      );
    }
  }

  // --- policy ---
  // policyViolation is computed by policy.ts so the rule catalog lives in one place.
  const policyViolation = evaluatePolicy(action);
  if (policyViolation) notes.push(`policy violation: ${policyViolation}`);

  return {
    riskTier,
    reversibility,
    externalVisibility,
    hasConfirmationToken,
    hasRevocationInHistory,
    revocationUnresolved,
    entityAmbiguity,
    missingCriticalParams,
    policyViolation,
    staleness,
    notes,
  };
}
