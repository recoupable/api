import { z } from "zod";
import { callContextRpc } from "./callContextRpc";

/** Server-only identity lookup. The caller must authorize the actor's selected workspace. */
export async function getContextRecordingIsrc(owner: string, requestId: string, subjectId: string) {
  z.uuid().parse(owner);
  z.uuid().parse(requestId);
  z.uuid().parse(subjectId);
  const result = z
    .strictObject({
      subjectId: z.uuid(),
      isrc: z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/),
    })
    .parse(
      await callContextRpc("resolve_context_recording_isrc", {
        p_owner: owner,
        p_request: requestId,
        p_subject: subjectId,
      }),
    );
  if (result.subjectId !== subjectId) throw new Error("Recording context identity mismatch");
  return result.isrc;
}
