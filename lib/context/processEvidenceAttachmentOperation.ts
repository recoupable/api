import type { EvidenceAttachmentOperation } from "./evidenceAttachmentSchemas";
import { validateEvidenceAttachmentResult } from "./validateEvidenceAttachmentResult";

/** Connect retained evidence using shared authorization and transaction-scoped checks. */
export async function processEvidenceAttachmentOperation(
  accountId: string,
  ownerId: string,
  args: EvidenceAttachmentOperation,
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>,
) {
  const scope = { p_actor: accountId, p_owner: ownerId };
  const operation =
    args.action === "list_evidence_attachments"
      ? {
          name: "list_context_evidence_attachments",
          params: { ...scope, p_version: args.source_version_id, p_after: args.after_id ?? null },
        }
      : args.action === "read_evidence_attachment"
        ? {
            name: "read_context_evidence_attachment",
            params: { ...scope, p_attachment: args.attachment_id },
          }
        : {
            name: "attach_context_evidence",
            params: {
              ...scope,
              p_version: args.source_version_id,
              p_key: args.idempotency_key,
              p_targets: args.targets,
            },
          };
  return validateEvidenceAttachmentResult(
    ownerId,
    args,
    await rpc(operation.name, operation.params),
  );
}
