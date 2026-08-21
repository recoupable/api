import type { Tables } from "@/types/database.types";
import { publicUploadUrl } from "@/lib/supabase/storage/publicUploadUrl";

export type MusicGeneration = {
  id: string;
  status: string;
  prompt: string;
  lyrics: string;
  title: string | null;
  model: string;
  duration_seconds: number | null;
  seed: number | null;
  num_inference_steps: number | null;
  guidance_scale: number | null;
  audio_url: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  organization_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Map a stored generation onto the documented resource
 * (recoupable/docs#308).
 *
 * Deliberately a whitelist, not a spread: the row carries the owning account,
 * the fal request id, the storage key, and what we charged, none of which a
 * client needs and some of which describe our cost base.
 *
 * `audio_url` prefers the mirrored object and falls back to the fal CDN url,
 * so a generation is playable in the window between fal finishing and the
 * mirror landing. Both are null until fal returns anything at all.
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
    title: row.title,
    model: row.model,
    duration_seconds: row.duration_seconds,
    seed: row.seed,
    num_inference_steps: row.num_inference_steps,
    guidance_scale: row.guidance_scale,
    audio_url: row.storage_key ? publicUploadUrl(row.storage_key) : row.source_url,
    mime_type: row.mime_type,
    file_size_bytes: row.file_size_bytes,
    organization_id: row.organization_id,
    error_message: row.error_message,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
