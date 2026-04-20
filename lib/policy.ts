import type { Action } from "./types";

// Hard refusal rules. These are deterministic, evaluated before the LLM is
// ever called. A match short-circuits the pipeline to REFUSE with the rule id
// as the rationale anchor.
//
// The goal is not to be exhaustive — it's to demonstrate the "code decides
// the hard gates, LLM decides the nuance" split. In production this would
// be driven by a policy config per tool/tenant.

export interface PolicyRule {
  id: string;
  description: string;
  match: (action: Action) => boolean;
}

const RESTRICTED_EMAIL_DOMAINS = new Set([
  "press.com",
  "media.com",
  "leak.example",
]);

export const POLICY_RULES: PolicyRule[] = [
  {
    id: "transfer_funds.amount_cap",
    description: "Fund transfers above $10,000 require human-in-the-loop, not alfred_.",
    match: (a) =>
      a.kind === "transfer_funds" &&
      typeof (a.params as any).amount_usd === "number" &&
      (a.params as any).amount_usd > 10_000,
  },
  {
    id: "email.restricted_domain",
    description:
      "Emailing known press/leak-channel domains is out of scope for automated assistance.",
    match: (a) => {
      if (a.kind !== "send_email" && a.kind !== "reply_email") return false;
      const to = ((a.params as any).to_email as string | undefined) ?? "";
      const at = to.indexOf("@");
      if (at < 0) return false;
      return RESTRICTED_EMAIL_DOMAINS.has(to.slice(at + 1).toLowerCase());
    },
  },
  {
    id: "delete_file.prod_path",
    description:
      "Deleting files under production paths must not be automated.",
    match: (a) => {
      if (a.kind !== "delete_file") return false;
      const path = ((a.params as any).path as string | undefined) ?? "";
      return /^\/(?:var\/)?(?:data|lib)\/prod(?:\/|$)/i.test(path);
    },
  },
  {
    id: "run_shell.destructive",
    description:
      "Shell commands matching destructive-root patterns are refused on sight.",
    match: (a) => {
      if (a.kind !== "run_shell") return false;
      const cmd = ((a.params as any).cmd as string | undefined) ?? "";
      return /\brm\s+-rf\s+\/(?!tmp\b)/.test(cmd);
    },
  },
];

export function evaluatePolicy(action: Action): string | null {
  for (const rule of POLICY_RULES) {
    if (rule.match(action)) return rule.id;
  }
  return null;
}

export function describePolicyRule(id: string): string {
  return (
    POLICY_RULES.find((r) => r.id === id)?.description ??
    "Policy rule matched."
  );
}
