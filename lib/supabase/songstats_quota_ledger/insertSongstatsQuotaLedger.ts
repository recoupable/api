import supabase from "../serverClient";
import { TablesInsert } from "@/types/database.types";

/**
 * Record Songstats quota spend. Throws on failure — unrecorded spend would
 * let the worker silently blow the rolling-window budget.
 *
 * @param entry - hits spent, optional purpose/account attribution
 * @throws Error if the insert fails
 */
export async function insertSongstatsQuotaLedger(
  entry: TablesInsert<"songstats_quota_ledger">,
): Promise<void> {
  const { error } = await supabase.from("songstats_quota_ledger").insert([entry]);

  if (error) {
    throw new Error(`Failed to record songstats quota spend: ${error.message}`);
  }
}
