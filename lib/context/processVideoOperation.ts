import type { ContextRequestRecord } from "./runContextRequest";
import { parseContextVideoUrl } from "./parseContextVideoUrl";
import type { VideoOperation } from "./videoOperationSchemas";

export type ContextVideoRequestRecord = Omit<ContextRequestRecord, "input"> & {
  input: { kind: "video"; url: string; videoId: string; identityConfirmed: false };
};

/** Save one YouTube video locator in the selected workspace after shared authorization; nothing is fetched, inferred or dispatched. */
export async function processVideoOperation(
  accountId: string,
  ownerId: string,
  args: VideoOperation,
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>,
) {
  const video = parseContextVideoUrl(args.url);
  const request = (await rpc("create_context_video_request", {
    p_owner: ownerId,
    p_actor: accountId,
    p_video: video.id,
    p_key: args.idempotency_key,
  })) as ContextVideoRequestRecord;
  return { request };
}
