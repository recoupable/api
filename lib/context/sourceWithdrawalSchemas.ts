import { z } from "zod";

/** Withdraw one recorded source input of a saved request; history is retained, nothing is deleted. */
export const sourceWithdrawalOperationSchemas = [
  z.strictObject({
    action: z.literal("withdraw_source"),
    organization_id: z.uuid().optional(),
    request_id: z.uuid(),
    source_id: z.uuid(),
  }),
] as const;
export type SourceWithdrawalOperation = z.infer<(typeof sourceWithdrawalOperationSchemas)[number]>;
