import { z } from "zod";
import { callContextRpc } from "./callContextRpc";

/** Read-only identity proof for a still-current catalog member; no collection grant. */
export async function getContextCatalogMemberRecordingIsrc(
  owner: string,
  requestId: string,
  recordingSubjectId: string,
) {
  z.uuid().parse(owner);
  z.uuid().parse(requestId);
  z.uuid().parse(recordingSubjectId);
  const result = z
    .strictObject({
      subjectId: z.uuid(),
      isrc: z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/),
    })
    .parse(
      await callContextRpc("resolve_context_catalog_member_recording", {
        p_owner: owner,
        p_request: requestId,
        p_recording: recordingSubjectId,
      }),
    );
  if (result.subjectId !== recordingSubjectId)
    throw new Error("Catalog member recording identity mismatch");
  return result.isrc;
}
