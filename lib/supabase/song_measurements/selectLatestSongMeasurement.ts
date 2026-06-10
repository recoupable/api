import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

/**
 * Select the most recent measurement for a (song, platform, metric) triple.
 * Uses the (song, platform, metric, captured_at DESC) series index.
 *
 * @param song - The song ISRC
 * @param platform - The platform (e.g. "spotify")
 * @param metric - The metric name (e.g. "platform_displayed_play_count")
 * @returns The latest measurement row, or null if none exists or on error
 */
export async function selectLatestSongMeasurement(
  song: string,
  platform: string,
  metric: string,
): Promise<Tables<"song_measurements"> | null> {
  const { data, error } = await supabase
    .from("song_measurements")
    .select("*")
    .eq("song", song)
    .eq("platform", platform)
    .eq("metric", metric)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}
