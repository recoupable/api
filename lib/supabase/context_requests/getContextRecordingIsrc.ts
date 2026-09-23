import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import supabase from "../serverClient";
import { callContextRpc } from "./callContextRpc";

/** Server-only identity lookup. The caller must authorize the actor's selected workspace. */
export async function getContextRecordingIsrc(owner: string, requestId: string, subjectId: string) {
  z.uuid().parse(owner);
  z.uuid().parse(requestId);
  z.uuid().parse(subjectId);
  const request = z
    .object({
      owner_id: z.uuid(),
      status: z.enum(["completed", "partial"]),
      output: z.object({ subjectIds: z.array(z.uuid()) }),
    })
    .parse(await callContextRpc("read_context_request", { p_owner: owner, p_request: requestId }));
  if (request.owner_id !== owner || !request.output.subjectIds.includes(subjectId))
    throw new Error("Recording context not accessible in selected request");
  // Context tables are additive migrations; validate their response until generated types catch up.
  const { data, error } = await (supabase as SupabaseClient)
    .from("context_subjects")
    .select("song_isrc")
    .eq("id", subjectId)
    .eq("kind", "recording")
    .maybeSingle();
  if (error) throw new Error("Recording context lookup failed");
  return z.object({ song_isrc: z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/) }).parse(data)
    .song_isrc;
}
