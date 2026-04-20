import { z } from "zod";

export const VerdictSchema = z.enum([
  "EXECUTE_SILENT",
  "EXECUTE_AND_NOTIFY",
  "CONFIRM",
  "CLARIFY",
  "REFUSE",
]);

// The shape the model must emit via the emit_decision tool.
export const ModelOutputSchema = z.object({
  verdict: VerdictSchema,
  rationale: z.string().min(1).max(800),
  userMessage: z.string().max(800).optional(),
  confidence: z.number().min(0).max(1),
});

export type ModelOutput = z.infer<typeof ModelOutputSchema>;

// Request body sent from the client to /api/decide
export const DecideRequestSchema = z.object({
  action: z.object({
    kind: z.string(),
    params: z.record(z.unknown()),
    reversible: z.boolean(),
    externallyVisible: z.boolean(),
    summary: z.string(),
  }),
  context: z.object({
    history: z.array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        ts: z.number(),
      }),
    ),
    userState: z
      .object({
        tz: z.string().optional(),
        role: z.string().optional(),
        trustedEntities: z.array(z.string()).optional(),
        contacts: z
          .array(z.object({ name: z.string(), email: z.string() }))
          .optional(),
      })
      .optional(),
    pendingAction: z
      .object({
        action: z.object({
          kind: z.string(),
          params: z.record(z.unknown()),
          reversible: z.boolean(),
          externallyVisible: z.boolean(),
          summary: z.string(),
        }),
        proposedAt: z.number(),
        status: z.enum(["awaiting_confirm", "paused", "revoked"]),
        reason: z.string().optional(),
      })
      .optional(),
    now: z.number().optional(),
  }),
  forcedFailure: z
    .enum(["none", "timeout", "malformed", "missing-context", "policy-violation"])
    .default("none"),
  mock: z.boolean().optional(),
  scenarioId: z.string().optional(),
});

export type DecideRequest = z.infer<typeof DecideRequestSchema>;
