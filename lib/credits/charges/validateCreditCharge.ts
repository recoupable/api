import { z } from "zod";
const count = z.number().int().min(0).max(2147483647).optional();
const schema = z.strictObject({
  accountId: z.uuid(),
  operationKey: z
    .string()
    .min(1)
    .max(200)
    .refine(value => value.trim().length > 0),
  creditsToDeduct: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  event: z.strictObject({
    source: z.enum(["api", "web"]).optional(),
    agent_type: z.enum(["main", "subagent"]).optional(),
    provider: z.string().optional(),
    model_id: z.string().optional(),
    input_tokens: count,
    cached_input_tokens: count,
    output_tokens: count,
    tool_call_count: count,
    resource_url: z.string().optional(),
  }),
});
export type CreditChargeInput = z.infer<typeof schema>;
/** Validate trusted server billing inputs without changing their operation identity. */
export function validateCreditCharge(input: CreditChargeInput): CreditChargeInput {
  return schema.parse(input);
}
