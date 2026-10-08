import type { ReleaseCaseOperation } from "./releaseCaseOperationSchemas";
import type { ReleaseCaseList, ReleaseCaseProjection, ReleaseCaseReview } from "./releaseCaseTypes";

/** Delegate only metadata case operations after shared actor/workspace authorization. */
export async function processReleaseCaseOperation(
  accountId: string,
  ownerId: string,
  args: ReleaseCaseOperation,
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>,
) {
  if (args.action === "list_release_cases")
    return (await rpc("list_context_release_cases", {
      p_actor: accountId,
      p_owner: ownerId,
      p_after: args.after_id ?? null,
    })) as ReleaseCaseList;
  if (args.action === "read_release_case")
    return (await rpc("read_context_release_case", {
      p_actor: accountId,
      p_owner: ownerId,
      p_request: args.request_id,
    })) as ReleaseCaseProjection;
  if (args.action === "read_release_case_review")
    return (await rpc("read_context_release_case_review", {
      p_actor: accountId,
      p_owner: ownerId,
      p_review: args.review_id,
    })) as ReleaseCaseReview;
  if (args.action === "review_release_case")
    return (await rpc("review_context_release_case", {
      p_actor: accountId,
      p_owner: ownerId,
      p_request: args.request_id,
      p_fingerprint: args.fingerprint,
      p_decision: args.decision,
      p_note: args.note,
      p_key: args.idempotency_key,
    })) as ReleaseCaseReview;
  throw new Error("Unknown release case operation");
}
