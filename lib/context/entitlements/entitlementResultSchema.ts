import { z } from "zod";
const decimal = z.string().regex(/^-?\d+(?:\.\d+)?$/);
const evidence = z.array(z.string());
export const entitlementResultSchema = z.strictObject({
  schema_version: z.literal("1"),
  status: z.enum(["ok", "partial"]),
  lines: z.array(
    z.strictObject({
      line_id: z.string(),
      rule_id: z.string(),
      rule_version: z.string(),
      status: z.literal("calculated"),
      currency: z.string(),
      period_start: z.string(),
      period_end: z.string(),
      expected_amount: decimal,
      reported_amount: decimal,
      variance: decimal,
      variance_direction: z.enum([
        "potential_underpayment",
        "potential_overpayment_or_clawback",
        "matched",
      ]),
      recovered_cash: z.null(),
      evidence_refs: evidence,
      bridge: z.array(
        z.strictObject({ operation: z.string(), amount: decimal, rate: decimal.optional() }),
      ),
    }),
  ),
  recoupment_accounts: z.array(
    z.strictObject({
      account_id: z.string(),
      currency: z.string(),
      opening_balance: decimal,
      movements: decimal,
      eligible_earnings: decimal,
      closing_balance: decimal,
      reported_closing_balance: decimal,
      closing_variance: decimal,
      potential_payable: decimal,
      earnings_line_ids: z.array(z.string()),
      evidence_refs: evidence,
      cash_received: z.null(),
    }),
  ),
  blockers: z.array(
    z.object({
      line_id: z.string().optional(),
      account_id: z.string().optional(),
      reason: z.string(),
      status: z.literal("manual_workpaper_required"),
    }),
  ),
  rounding_policy: z.string(),
  limitations: z.string(),
});
export type EntitlementResult = z.infer<typeof entitlementResultSchema>;
