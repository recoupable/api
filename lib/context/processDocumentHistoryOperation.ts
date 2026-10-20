import type { DocumentHistoryOperation } from "./documentHistorySchemas";
import type { ContextDocumentHistory, ContextDocumentHistoryResult } from "./documentHistoryTypes";

/** Read immutable document lineage after shared workspace authorization; a null read never leaks existence. */
export async function processDocumentHistoryOperation(
  ownerId: string,
  args: DocumentHistoryOperation,
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>,
): Promise<ContextDocumentHistoryResult> {
  const history = (await rpc("read_context_document_history", {
    p_owner: ownerId,
    p_document: args.document_id,
    p_before: args.before_revision ?? null,
    p_limit: args.limit,
  })) as ContextDocumentHistory | null;
  if (!history)
    return { state: "not_found", document: null, versions: [], has_more: false, next_before: null };
  return { state: "found", ...history };
}
