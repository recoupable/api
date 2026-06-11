import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

/**
 * Select snapshot job rows with optional filters — by account (per-org cap
 * window), creation lower bound, and schedule (due monthly re-runs).
 *
 * @param params.id - Optional snapshot id filter
 * @param params.account - Optional account filter
 * @param params.createdAfter - Optional inclusive created_at lower bound (ISO)
 * @param params.schedule - Optional schedule filter ("once" | "monthly")
 * @returns Matching rows newest-first, or [] if none exist or on error
 */
export async function selectPlaycountSnapshots({
  id,
  account,
  createdAfter,
  schedule,
}: {
  id?: string;
  account?: string;
  createdAfter?: string;
  schedule?: string;
}): Promise<Tables<"playcount_snapshots">[]> {
  let query = supabase
    .from("playcount_snapshots")
    .select("*")
    .order("created_at", { ascending: false });

  if (id) query = query.eq("id", id);
  if (account) query = query.eq("account", account);
  if (schedule) query = query.eq("schedule", schedule);
  if (createdAfter) query = query.gte("created_at", createdAfter);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching playcount_snapshots:", error);
    return [];
  }

  return data || [];
}
