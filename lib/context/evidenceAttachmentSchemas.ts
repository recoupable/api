import { z } from "zod";
import { canonicalEvidenceTargets } from "./canonicalEvidenceTargets";
import { contextIngestSchema } from "./schema";

const organizationId = z
  .uuid()
  .describe(
    "Optional organization workspace. Current membership and ownership are checked; omitting it uses personal scope.",
  );
const sourceVersionId = z
  .uuid()
  .describe("Exact retained source-version ID; use a new association for a later version.");
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
  })
  .meta({
    uniqueItems: true,
    description:
      "Distinct typed targets. The server also rejects UUID duplicates that differ only in case.",
  });

export const evidenceAttachmentOperationSchemas = [
  z.strictObject({
    action: z.literal("attach_evidence"),
    organization_id: organizationId.optional(),
    source_version_id: sourceVersionId,
    targets: evidenceTargetsSchema,
    idempotency_key: contextIngestSchema.shape.idempotency_key,
  }),
  z.strictObject({
    action: z.literal("read_evidence_attachment"),
    organization_id: organizationId.optional(),
    attachment_id: z.uuid(),
  }),
  z.strictObject({
    action: z.literal("list_evidence_attachments"),
    organization_id: organizationId.optional(),
    source_version_id: sourceVersionId,
    after_id: z
      .uuid()
      .nullish()
      .describe(
        "Pass the returned next_id as after_id while has_more is true, including empty pages with withheld receipts.",
      ),
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
    next_id: z
      .uuid()
      .nullable()
      .describe(
        "Pass as after_id on the next request while has_more is true, including empty pages.",
      ),
    has_more: z
      .boolean()
      .describe(
        "Continue using next_id as after_id while true; an empty items array alone does not mean the end.",
      ),
  })
  .superRefine((page, ctx) => {
    if (
      page.has_more !== (page.next_id !== null) ||
      new Set(page.items.map(item => item.id.toLowerCase())).size !== page.items.length
    )
      ctx.addIssue({ code: "custom", message: "Invalid evidence page" });
  });
