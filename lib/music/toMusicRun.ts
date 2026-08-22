import type { Tables } from "@/types/database.types";
import { publicUploadUrl } from "@/lib/supabase/storage/publicUploadUrl";

export type MusicRun = {
  id: string;
  kind: "music";
  state: "queued" | "generating" | "complete" | "failed";
  created_at: string;
  result: { generation_id: string; audio_url: string | null } | null;
};

/**
 * Map a generation row onto the generic run resource (contract:
 * recoupable/docs#308).
 *
 * Storage values never reach the contract, the same discipline
 * `toValuationRun` applies. An unrecognized status reads as `generating`
 * rather than a terminal phase, so a state this mapper has not been taught
 * about can never make a polling client stop on a run that is still going.
 *
 * @param row - The stored generation.
 * @returns The run resource.
 */
export function toMusicRun(row: Tables<"music_generations">): MusicRun {
  let state: MusicRun["state"];
  if (row.status === "pending") state = "queued";
  else if (row.status === "completed") state = "complete";
  else if (row.status === "failed") state = "failed";
  else state = "generating";

  return {
    id: row.id,
    kind: "music",
    state,
    created_at: row.created_at,
    result:
      state === "complete"
        ? {
            generation_id: row.id,
            audio_url: row.storage_key ? publicUploadUrl(row.storage_key) : null,
          }
        : null,
  };
}
