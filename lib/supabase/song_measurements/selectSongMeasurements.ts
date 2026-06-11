import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

/**
 * Select measurements for a (song, platform, metric) triple, newest first.
 * Uses the (song, platform, metric, captured_at DESC) series index; pass
 * `limit: 1` for the latest capture, omit for the full series.
 *
 * @param params.song - The song ISRC
 * @param params.platform - The platform (e.g. "spotify")
 * @param params.metric - The metric name (e.g. "platform_displayed_play_count")
 * @param params.limit - Optional cap on returned rows
 * @returns Measurement rows newest-first, or [] if none exist or on error
 */
export async function selectSongMeasurements({
  song,
  platform,
  metric,
  limit,
}: {
  song: string;
  platform: string;
  metric: string;
  limit?: number;
}): Promise<Tables<"song_measurements">[]> {
  let query = supabase
    .from("song_measurements")
    .select("*")
    .eq("song", song)
    .eq("platform", platform)
    .eq("metric", metric)
    .order("captured_at", { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching song_measurements:", error);
    return [];
  }

  return data || [];
}
