import { z } from "zod";

/**
 * Withdraw one recorded source input of a saved request, named by its source ID or by one of
 * its version IDs (brief input manifests expose sourceVersionIds). Rows are kept; nothing is deleted.
 */
export const sourceWithdrawalOperationSchemas = [
  z
    .strictObject({
      action: z.literal("withdraw_source"),
      organization_id: z.uuid().optional(),
      request_id: z.uuid(),
      source_id: z.uuid().optional(),
      source_version_id: z.uuid().optional(),
    })
    .refine(value => (value.source_id === undefined) !== (value.source_version_id === undefined), {
      message: "Provide exactly one of source_id or source_version_id",
      path: ["source_id"],
    }),
] as const;
export type SourceWithdrawalOperation = z.infer<(typeof sourceWithdrawalOperationSchemas)[number]>;
