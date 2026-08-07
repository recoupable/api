import supabase from "@/lib/supabase/serverClient";

/**
 * Select scrape-digest send-log rows with optional filters.
 *
 * @param batchId - Rows recording exactly this batch's send (idempotency check).
 * @param artistIds - Rows for any of these watched artist entities.
 * @param since - Only rows created at or after this ISO timestamp (rate-cap lookback).
 */
export async function selectScrapeDigestLogs({
  batchId,
  artistIds,
  since,
}: {
  batchId?: string;
  artistIds?: string[];
  since?: string;
} = {}) {
  if (artistIds !== undefined && artistIds.length === 0) return [];

  let query = supabase.from("email_send_log").select("account_id, created_at");

  if (batchId) {
    query = query.eq("raw_body", `scrape-digest:${batchId}`);
  } else {
    query = query.like("raw_body", "scrape-digest:%");
  }
  if (artistIds) query = query.in("account_id", artistIds);
  if (since) query = query.gte("created_at", since);

  const { data, error } = await query;
  if (error) {
    console.error("[ERROR] selectScrapeDigestLogs:", error);
    return [];
  }
  return data ?? [];
}
