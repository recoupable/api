import { commandScopeSchema, receiptSchema, type CommandScope, type Selection } from "./schemas";
/** Proposal only. Reconcile is the existing current-authorized command read, not a client receipt. */
export async function readRetainedFieldSelection(
  input: unknown,
  reconcile?: (scope: CommandScope) => Promise<unknown>,
): Promise<
  { state: "ready"; selection: Selection } | { state: "invalid" | "unavailable" | "error" }
> {
  const scope = commandScopeSchema.safeParse(input);
  if (!scope.success) return { state: "invalid" };
  if (!reconcile) return { state: "unavailable" };
  try {
    const parsed = receiptSchema.safeParse(await reconcile(scope.data));
    if (!parsed.success) return { state: "unavailable" };
    const r = parsed.data;
    if (
      r.ownerId !== scope.data.workspaceId ||
      r.requestId !== scope.data.requestId ||
      r.catalogId !== scope.data.catalogId ||
      r.key !== scope.data.key
    )
      return { state: "unavailable" };
    return {
      state: "ready",
      selection: {
        ownerId: r.ownerId,
        requestId: r.requestId,
        subjectId: r.subjectId,
        catalogId: r.catalogId,
        resultId: r.resultId,
        revision: r.revision,
        topic: "catalog_retained_streams",
        sourceVersionIds: [r.sourceVersionId],
      },
    };
  } catch {
    return { state: "error" };
  }
}
