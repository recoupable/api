import { z } from "zod";
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const packFoundationPlanSchema = z.strictObject({
  version: z.literal(1),
  job_id: z.string(),
  owner_id: z.string(),
  revision: z.number().int().positive(),
  quote_id: z.string(),
  quote_sha256: digest,
  direction_sha256: digest,
  asset_id: z.string().nullable(),
  selection: z.enum(["explicit", "fallback", "none_requested", "missing"]),
  dependent_asset_ids: z.array(z.string()),
  digest,
});
export const packFoundationRecordSchema = z
  .strictObject({
    plan: packFoundationPlanSchema,
    state: z.enum(["pending", "ready", "none_requested", "unavailable"]),
    asset_sha256: digest.optional(),
    dependency_bindings: z
      .array(z.strictObject({ asset_id: z.string(), attempt: z.number().int().positive() }))
      .optional(),
    files: z.array(
      z.strictObject({
        storage_key: z.string(),
        content_type: z.string(),
        bytes: z.number().int().nonnegative(),
        sha256: digest,
      }),
    ),
    reason: z
      .enum(["missing", "pending", "in_flight", "failed", "uncertain", "not_usable"])
      .optional(),
  })
  .superRefine((record, ctx) => {
    if (
      record.state === "ready" &&
      (!record.plan.asset_id || !record.asset_sha256 || !record.files.length || record.reason)
    )
      ctx.addIssue({
        code: "custom",
        message: "Ready foundation requires retained asset and file hashes",
      });
    if (record.state !== "ready" && (record.asset_sha256 || record.files.length))
      ctx.addIssue({ code: "custom", message: "Unready foundation cannot claim retained files" });
    if (
      record.state === "none_requested" &&
      (record.plan.selection !== "none_requested" || record.plan.asset_id)
    )
      ctx.addIssue({ code: "custom", message: "No-artwork state requires no quoted foundation" });
  });
export type PackFoundationPlan = z.infer<typeof packFoundationPlanSchema>;
export type PackFoundationRecord = z.infer<typeof packFoundationRecordSchema>;
export type PackFoundationSelection = { foundationAssetId?: string; dependentAssetIds: string[] };
