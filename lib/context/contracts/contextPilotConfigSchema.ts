import { z } from "zod";

const unresolved = z.literal("unresolved");

/**
 * Pilot configuration fields that must be resolved before paid activation.
 *
 * Each field is either a concrete value or the literal `"unresolved"`. Nothing
 * here grants spending: credit reservation and settlement belong to #2123/#2105.
 * This schema only names the decisions a paid pilot needs and makes an
 * unresolved decision explicit instead of defaulting it.
 */
export const contextPilotConfigSchema = z.strictObject({
  /** Maximum credits one pilot request may reserve across its paid modules. */
  spend_ceiling_credits: z.union([unresolved, z.number().int().positive()]),
  /** What happens when a provider charged for output the engine cannot use. */
  paid_but_unusable_output: z.union([
    unresolved,
    z.enum(["record_cost_mark_unavailable", "record_cost_retry_once"]),
  ]),
  /** How long retained evidence lives and what withdrawal removes. */
  retention_withdrawal: z.union([
    unresolved,
    z.strictObject({
      retention_days: z.number().int().positive(),
      withdrawal_removes_future_use: z.literal(true),
    }),
  ]),
  /** When accepted evidence is considered stale for reuse. */
  freshness: z.union([unresolved, z.strictObject({ max_age_days: z.number().int().positive() })]),
  /** Whether unresolved readiness blocks only dependent actions or every paid action. */
  readiness_behavior: z.union([
    unresolved,
    z.enum(["block_dependent_actions_only", "block_all_paid"]),
  ]),
});

export type ContextPilotConfig = z.infer<typeof contextPilotConfigSchema>;
export type ContextPilotConfigField = keyof ContextPilotConfig;
