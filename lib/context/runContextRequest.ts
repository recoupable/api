import { randomUUID } from "node:crypto";
import { parseContextUrl } from "./parseContextUrl";
import type { SpotifyContext } from "./fetchSpotifyContext";

export interface ContextRequestRecord {
  id: string;
  owner_id: string;
  created_by: string;
  input: { url: string; topics?: string[] };
  status: string;
}
export interface ContextRunnerDependencies {
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>;
  authorize: (actor: string, owner: string) => Promise<unknown>;
  extract: (id: string) => Promise<SpotifyContext>;
}
/** Durable database claims protect duplicate workflow deliveries; ownership is rechecked at commit. */
export async function runContextRequest(
  actor: string,
  owner: string,
  requestId: string,
  deps: ContextRunnerDependencies,
) {
  await deps.authorize(actor, owner);
  const request = (await deps.rpc("read_context_request", {
    p_owner: owner,
    p_request: requestId,
  })) as ContextRequestRecord;
  if (!request || request.owner_id !== owner) throw new Error("Context request not found");
  if (["completed", "partial", "cancelled"].includes(request.status)) return request;
  const token = randomUUID();
  const claimed = await deps.rpc("claim_context_request", {
    p_owner: owner,
    p_request: requestId,
    p_token: token,
  });
  if (!claimed) return request;
  try {
    const resource = parseContextUrl(request.input.url);
    if (resource.provider !== "spotify")
      throw new Error("YouTube context ingestion is not enabled yet");
    const payload = await deps.extract(resource.id);
    await deps.authorize(actor, owner);
    return await deps.rpc("commit_spotify_context", {
      p_owner: owner,
      p_request: requestId,
      p_token: token,
      p_payload: payload,
    });
  } catch (error) {
    await deps.rpc("fail_context_request", {
      p_owner: owner,
      p_request: requestId,
      p_token: token,
      p_error:
        "Context extraction failed. Retry this request after checking provider access or identity conflicts.",
    });
    throw error;
  }
}
