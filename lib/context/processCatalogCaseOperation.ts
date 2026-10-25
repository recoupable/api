import { sameCatalogUuid } from "./sameCatalogUuid";
import type { CatalogCaseOperation } from "./catalogCaseOperationSchemas";
import { validateCatalogCaseResult } from "./validateCatalogCaseResult";

/** Save/read assertion artifacts only; provider execution and authorization remain unsupported. */
export async function processCatalogCaseOperation(
  accountId: string,
  ownerId: string,
  args: CatalogCaseOperation,
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>,
) {
  const scope = { p_actor: accountId, p_owner: ownerId };
  if (args.action === "save_catalog_case" && !sameCatalogUuid(args.snapshot.workspace_id, ownerId))
    throw new Error("Catalog case workspace differs from authorized scope");
  const operation =
    args.action === "save_catalog_case"
      ? {
          name: "save_context_catalog_case",
          params: {
            ...scope,
            p_case: args.case_id,
            p_expected_revision: args.expected_revision,
            p_key: args.idempotency_key,
            p_snapshot: args.snapshot,
          },
        }
      : args.action === "read_catalog_case"
        ? {
            name: "read_context_catalog_case",
            params: { ...scope, p_case: args.case_id, p_revision: args.revision ?? null },
          }
        : {
            name: "list_context_catalog_cases",
            params: { ...scope, p_after: args.after_id ?? null, p_limit: args.limit },
          };
  return validateCatalogCaseResult(ownerId, args, await rpc(operation.name, operation.params));
}
