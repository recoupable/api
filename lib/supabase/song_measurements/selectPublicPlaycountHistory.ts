import supabase from "../serverClient";

/**
 * Bounded public Spotify displayed-count history for one recording. Excludes private/provider
 * analytics and raw run IDs. A count check detects server truncation; failures never look like zero.
 * @param params - Recording and inclusive UTC observation dates.
 * @throws Error on query failure, overflow, or server truncation.
 */
export async function selectPublicPlaycountHistory(params: {
  song: string;
  since: string;
  until: string;
}) {
  const end = new Date(`${params.until}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const { data, count, error } = await supabase
    .from("song_measurements")
    .select("captured_at,value", { count: "exact" })
    .eq("song", params.song)
    .eq("platform", "spotify")
    .eq("metric", "platform_displayed_play_count")
    .eq("data_source", "apify_spotify_playcount")
    .gte("captured_at", `${params.since}T00:00:00Z`)
    .lt("captured_at", end.toISOString())
    .order("captured_at", { ascending: true })
    .limit(500);
  if (error || count === null || count > 500 || count !== (data ?? []).length) {
    throw new Error("Playcount history unavailable or exceeds read limit; use a shorter period");
  }
  return data ?? [];
}
