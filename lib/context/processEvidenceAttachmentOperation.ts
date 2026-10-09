import {
  evidenceAttachmentListSchema,
  evidenceAttachmentReceiptSchema,
  type EvidenceAttachmentOperation,
  type EvidenceAttachmentReceipt,
} from "./evidenceAttachmentSchemas";
import { canonicalEvidenceTargets } from "./canonicalEvidenceTargets";

/** Connect retained evidence using shared authorization and transaction-scoped checks. */
export async function processEvidenceAttachmentOperation(
  accountId: string,
  ownerId: string,
  args: EvidenceAttachmentOperation,
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>,
) {
  const authorizeReceipt = (receipt: EvidenceAttachmentReceipt) => {
    if (
      receipt.owner_id.toLowerCase() !== ownerId.toLowerCase() ||
      (args.action !== "read_evidence_attachment" &&
        receipt.source_version_id.toLowerCase() !== args.source_version_id.toLowerCase())
    )
      throw new Error("Evidence receipt scope mismatch");
    return receipt;
  };
  const scope = { p_actor: accountId, p_owner: ownerId };
  if (args.action === "list_evidence_attachments") {
    const page = evidenceAttachmentListSchema.parse(
      await rpc("list_context_evidence_attachments", {
        ...scope,
        p_version: args.source_version_id,
        p_after: args.after_id ?? null,
      }),
    );
    page.items.forEach(authorizeReceipt);
    return page;
  }
  if (args.action === "read_evidence_attachment") {
    const receipt = authorizeReceipt(
      evidenceAttachmentReceiptSchema.parse(
        await rpc("read_context_evidence_attachment", {
          ...scope,
          p_attachment: args.attachment_id,
        }),
      ),
    );
    if (receipt.id.toLowerCase() !== args.attachment_id.toLowerCase())
      throw new Error("Evidence receipt ID mismatch");
    return receipt;
  }
  const receipt = authorizeReceipt(
    evidenceAttachmentReceiptSchema.parse(
      await rpc("attach_context_evidence", {
        ...scope,
        p_version: args.source_version_id,
        p_key: args.idempotency_key,
        p_targets: args.targets,
      }),
    ),
  );
  if (
    JSON.stringify(canonicalEvidenceTargets(receipt.targets)) !==
    JSON.stringify(canonicalEvidenceTargets(args.targets))
  )
    throw new Error("Evidence receipt targets mismatch");
  return receipt;
}
