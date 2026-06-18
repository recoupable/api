import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

/**
 * Select measurements newest-first. Filter by one song, a batch of songs, or a
 * snapshot (one of the three is required), and optionally by platform/metric.
 * Uses the (song, platform, metric, captured_at DESC) series index; pass
 * `limit: 1` for the latest capture, omit for the full series.
 *
 * @param params.song - Single song ISRC filter
 * @param params.songs - Batch of song ISRCs (e.g. all tracks on an album)
 * @param params.snapshot - Snapshot id filter (all measurements captured for a run)
 * @param params.platform - Optional platform filter (e.g. "spotify")
 * @param params.metric - Optional metric filter (e.g. "platform_displayed_play_count")
 * @param params.limit - Optional cap on returned rows
 * @returns Measurement rows newest-first, or [] if none exist or on error
 */
export async function selectSongMeasurements({
  song,
  songs,
  snapshot,
  platform,
  metric,
  limit,
}: {
  song?: string;
  songs?: string[];
  snapshot?: string;
  platform?: string;
  metric?: string;
  limit?: number;
}): Promise<Tables<"song_measurements">[]> {
  if (!song && (!songs || songs.length === 0) && !snapshot) return [];

  let query = supabase
    .from("song_measurements")
    .select("*")
    .order("captured_at", { ascending: false });

  if (song) query = query.eq("song", song);
  if (songs && songs.length > 0) query = query.in("song", songs);
  if (snapshot) query = query.eq("snapshot", snapshot);
  if (platform) query = query.eq("platform", platform);
  if (metric) query = query.eq("metric", metric);
  if (limit) query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching song_measurements:", error);
    return [];
  }

  return data || [];
}
