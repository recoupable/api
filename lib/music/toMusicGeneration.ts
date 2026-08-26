import type { Tables } from "@/types/database.types";
import { publicUploadUrl } from "@/lib/supabase/storage/publicUploadUrl";

export type MusicGeneration = {
  id: string;
  status: string;
  prompt: string;
  lyrics: string;
  model: string;
  duration_seconds: number | null;
  audio_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Map a stored generation onto the documented resource
 * (recoupable/docs#308).
 *
 * A whitelist, not a spread: the row also carries the owning account and the
 * handles to fal and the workflow run, none of which a client needs.
 *
 * @param row - The stored generation.
 * @returns The client-facing generation resource.
 */
export function toMusicGeneration(row: Tables<"music_generations">): MusicGeneration {
  return {
    id: row.id,
    status: row.status,
    prompt: row.prompt,
    lyrics: row.lyrics,
    model: row.model,
    duration_seconds: row.duration_seconds,
    // Serve our own mirrored object. Nothing is playable until the mirror
    // lands, which is also when the generation reports completed.
    audio_url: row.storage_key ? publicUploadUrl(row.storage_key) : null,
    error_message: row.error_message,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
