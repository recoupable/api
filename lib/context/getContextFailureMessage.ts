/** Give evidence callers actionable retry guidance while preserving legacy Context messages. */
export function getContextFailureMessage(action: string) {
  if (action === "save_catalog_case")
    return "Catalog case save could not complete. Check workspace, retained sources and expected revision. Retry an uncertain save only with the same idempotency key and unchanged payload; read the current revision before editing.";
  if (action === "read_catalog_case" || action === "list_catalog_cases")
    return "Catalog case read could not complete. Check workspace access, case/revision and retained evidence before retrying.";
  if (action === "attach_evidence")
    return "Evidence attachment could not complete. Check workspace, source retention and target access. Retry only the same source version, targets and idempotency key.";
  if (action === "read_evidence_attachment" || action === "list_evidence_attachments")
    return "Evidence read could not complete. Check workspace, source retention and target access before retrying.";
  return "Context operation could not complete. Check scope, request ID and provider availability; retry ingestion with the same idempotency key.";
}
