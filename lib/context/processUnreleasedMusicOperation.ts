import type { UnreleasedMusicOperation } from "./unreleasedMusicOperationSchemas";
import type { ContextRequestRecord } from "./runContextRequest";

type SavedRequest<Kind extends string> = Omit<ContextRequestRecord, "input"> & {
  input: { kind: Kind; title: string; contentHash: string; identityConfirmed: false };
};

/**
 * Save an unreleased recording or planned release after shared actor/workspace authorization.
 * The database assigns an internal identity and records ISRC, UPC and store IDs as unknown;
 * nothing is dispatched, looked up or charged.
 */
export async function processUnreleasedMusicOperation(
  accountId: string,
  ownerId: string,
  args: UnreleasedMusicOperation,
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>,
) {
  if (args.action === "ingest_unreleased_recording")
    return {
      request: (await rpc("create_context_unreleased_recording_request", {
        p_owner: ownerId,
        p_actor: accountId,
        p_recording: args.recording,
        p_key: args.idempotency_key,
      })) as SavedRequest<"unreleased_recording">,
    };
  if (args.action === "ingest_planned_release")
    return {
      request: (await rpc("create_context_planned_release_request", {
        p_owner: ownerId,
        p_actor: accountId,
        p_release: args.release,
        p_key: args.idempotency_key,
      })) as SavedRequest<"planned_release">,
    };
  throw new Error("Unknown unreleased music operation");
}
