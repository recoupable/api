import type { ContextRequestRecord } from "../runContextRequest";
import { parseContextUrl } from "../parseContextUrl";
import { contextVideoEvidenceSchema } from "./contextVideoEvidenceSchema";

export type ContextVideoEvidenceReaders = {
  readRequest: (owner: string, requestId: string) => Promise<ContextRequestRecord>;
  /** Return retained authorized evidence; never infer identity from the uploader. */
  readEvidence: (owner: string, requestId: string) => Promise<unknown>;
};

/** Load and bind one retained request after caller authorization, using canonical scope UUIDs. */
export async function loadContextVideoEvidence(
  owner: string,
  requestId: string,
  deps: ContextVideoEvidenceReaders,
) {
  const request = await deps.readRequest(owner, requestId);
  if (
    !request ||
    request.id.toLowerCase() !== requestId ||
    request.owner_id.toLowerCase() !== owner ||
    request.status === "cancelled"
  )
    throw new Error("Video context request unavailable");
  const resource = parseContextUrl(request.input.url);
  if (resource.provider !== "youtube") throw new Error("Single YouTube video required");
  const evidence = contextVideoEvidenceSchema.parse(await deps.readEvidence(owner, requestId));
  if (
    evidence.requestId.toLowerCase() !== requestId ||
    evidence.ownerId.toLowerCase() !== owner ||
    evidence.videoId !== resource.id
  )
    throw new Error("Video evidence does not match the selected request");
  return { resourceUrl: resource.url, evidence };
}
