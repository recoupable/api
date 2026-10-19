import {
  evidenceAttachmentListSchema,
  evidenceAttachmentReceiptSchema,
  type EvidenceAttachmentOperation,
  type EvidenceAttachmentReceipt,
} from "./evidenceAttachmentSchemas";
import { canonicalEvidenceTargets } from "./canonicalEvidenceTargets";

/** Withhold any result that does not match the operation's selected scope and identity. */
export function validateEvidenceAttachmentResult(
  ownerId: string,
  args: EvidenceAttachmentOperation,
  value: unknown,
) {
  const checkScope = (receipt: EvidenceAttachmentReceipt) => {
    if (
      receipt.owner_id.toLowerCase() !== ownerId.toLowerCase() ||
      (args.action !== "read_evidence_attachment" &&
        receipt.source_version_id.toLowerCase() !== args.source_version_id.toLowerCase())
    )
      throw new Error("Evidence receipt scope mismatch");
    return receipt;
  };
  if (args.action === "list_evidence_attachments") {
    const page = evidenceAttachmentListSchema.parse(value);
    page.items.forEach(checkScope);
    return page;
  }
  const receipt = checkScope(evidenceAttachmentReceiptSchema.parse(value));
  if (args.action === "read_evidence_attachment") {
    if (receipt.id.toLowerCase() !== args.attachment_id.toLowerCase())
      throw new Error("Evidence receipt ID mismatch");
  } else if (
    JSON.stringify(canonicalEvidenceTargets(receipt.targets)) !==
    JSON.stringify(canonicalEvidenceTargets(args.targets))
  )
    throw new Error("Evidence receipt targets mismatch");
  return receipt;
}
