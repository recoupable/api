import supabase from "@/lib/supabase/serverClient";

/**
 * Returns scrape-digest send-log rows for any of the given artist entity ids
 * newer than `since` — the digest rate cap's lookback (chat#1855).
 */
export async function selectRecentScrapeDigestLogs(artistIds: string[], since: string) {
  if (!artistIds.length) return [];
  const { data, error } = await supabase
    .from("email_send_log")
    .select("account_id, created_at")
    .in("account_id", artistIds)
    .like("raw_body", "scrape-digest:%")
    .gte("created_at", since);
  if (error) {
    console.error("[ERROR] selectRecentScrapeDigestLogs:", error);
    return [];
  }
  return data ?? [];
}
