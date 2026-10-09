import { z } from "zod";

export const evidenceManifestOperationSchema = z.strictObject({
  action: z.literal("list_evidence_versions"),
  request_id: z.uuid(),
  organization_id: z.uuid().optional(),
  after_id: z.uuid().optional(),
});
export const evidenceManifestPageSchema = z.strictObject({
  request_id: z.uuid(),
  owner_id: z.uuid(),
  versions: z
    .array(
      z.strictObject({
        source_version_id: z.uuid(),
        source_id: z.uuid(),
        source_kind: z.enum([
          "provider_metadata",
          "audio",
          "lyrics",
          "artwork",
          "web",
          "social",
          "customer",
        ]),
        fingerprint: z.string().length(64),
        retrieved_at: z.iso.datetime({ offset: true }),
        evidence_kinds: z
          .array(z.enum(["observation", "estimate", "interpretation", "customer_assertion"]))
          .min(1)
          .max(4),
        is_current: z.boolean(),
      }),
    )
    .max(50),
  has_more: z.boolean(),
  next_id: z.uuid().nullable(),
});
