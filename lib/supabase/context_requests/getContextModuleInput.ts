import { z } from "zod";
import { getContextRecordingIsrc } from "./getContextRecordingIsrc";
import { callContextRpc } from "./callContextRpc";
import { listContextRequestTargets } from "./listContextRequestTargets";
import { songstatsContextSchema } from "@/lib/context/providers/lookupSongstatsContext";
const schema = z.object({
  module: z.enum(["musicbrainz", "mlc_recording", "spotify_release", "songstats"]),
  subjectId: z.uuid(),
});
/** Server-only loader. Authorize workspace access before calling; version comes from server policy. */
export async function getContextModuleInput(
  owner: string,
  requestId: string,
  input: unknown,
  collectionVersion: string,
) {
  z.uuid().parse(owner);
  z.uuid().parse(requestId);
  const node = schema.parse(input);
  const version = z.string().min(1).max(100).parse(collectionVersion);
  if (node.module === "songstats") {
    const targets = await listContextRequestTargets(owner, requestId);
    const target = targets.find(item => item.subjectId === node.subjectId);
    if (!target?.identityConfirmed || !["recording", "artist"].includes(target.kind))
      throw new Error("Songstats subject identity is not confirmed");
    const identifier =
      target.kind === "recording" && target.availableFields.includes("isrc")
        ? "isrc"
        : "spotify_id";
    if (!target.availableFields.includes(identifier))
      throw new Error("Songstats subject has no supported identifier");
    const lookup = songstatsContextSchema.parse(
      await callContextRpc("resolve_context_songstats_lookup", {
        p_owner: owner,
        p_request: requestId,
        p_subject: node.subjectId,
        p_kind: target.kind,
        p_identifier: identifier,
      }),
    );
    return { lookup, collectionVersion: version };
  }
  if (node.module === "spotify_release") {
    const result = z.object({ releaseId: z.string().regex(/^[A-Za-z0-9]{22}$/) }).parse(
      await callContextRpc("resolve_context_spotify_release", {
        p_owner: owner,
        p_request: requestId,
        p_subject: node.subjectId,
      }),
    );
    return { releaseId: result.releaseId, collectionVersion: version };
  }
  const isrc = await getContextRecordingIsrc(owner, requestId, node.subjectId);
  return { isrc, collectionVersion: version };
}
