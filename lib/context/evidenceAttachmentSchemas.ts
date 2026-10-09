import { z } from "zod";
import { canonicalEvidenceTargets } from "./canonicalEvidenceTargets";
import { contextIngestSchema } from "./schema";

export const evidenceTargetsSchema = z
  .array(
    z.union([
      z.strictObject({ artist_id: z.uuid() }),
      z.strictObject({ professional_id: z.uuid() }),
      z.strictObject({ request_id: z.uuid(), subject_id: z.uuid() }),
    ]),
  )
  .min(1)
  .max(100)
  .superRefine((targets, ctx) => {
    if (new Set(canonicalEvidenceTargets(targets)).size !== targets.length)
      ctx.addIssue({ code: "custom", message: "Duplicate evidence target" });
  });

export const evidenceAttachmentOperationSchemas = [
  z.strictObject({
    action: z.literal("attach_evidence"),
    organization_id: z.uuid().optional(),
    source_version_id: z.uuid(),
    targets: evidenceTargetsSchema,
    idempotency_key: contextIngestSchema.shape.idempotency_key,
  }),
  z.strictObject({
    action: z.literal("read_evidence_attachment"),
    organization_id: z.uuid().optional(),
    attachment_id: z.uuid(),
  }),
  z.strictObject({
    action: z.literal("list_evidence_attachments"),
    organization_id: z.uuid().optional(),
    source_version_id: z.uuid(),
    after_id: z.uuid().nullish(),
  }),
] as const;
export type EvidenceAttachmentOperation = z.infer<
  (typeof evidenceAttachmentOperationSchemas)[number]
>;

export const evidenceAttachmentReceiptSchema = z.strictObject({
  id: z.uuid(),
  owner_id: z.uuid(),
  actor_id: z.uuid(),
  source_version_id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
  targets: evidenceTargetsSchema,
  assertion: z.literal("relevance_only"),
  rights_verified: z.literal(false),
  policy_version: z.literal("private-evidence-association-v1"),
});
export type EvidenceAttachmentReceipt = z.infer<typeof evidenceAttachmentReceiptSchema>;

export const evidenceAttachmentListSchema = z
  .strictObject({
    items: z.array(evidenceAttachmentReceiptSchema).max(50),
    next_id: z.uuid().nullable(),
    has_more: z.boolean(),
  })
  .superRefine((page, ctx) => {
    if (
      page.has_more !== (page.next_id !== null) ||
      new Set(page.items.map(item => item.id.toLowerCase())).size !== page.items.length
    )
      ctx.addIssue({ code: "custom", message: "Invalid evidence page" });
  });
