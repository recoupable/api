import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

/**
 * The account's most recent snapshot runs, newest first (chat#1973). Dedicated
 * to the runs read: unlike selectPlaycountSnapshots this THROWS on query error
 * — a database failure must never read as "this account has never run one"
 * (the empty-vs-error conflation class, chat#1965). Ties on created_at break
 * by id so a limited read is stable across requests.
 *
 * @param params.account - The owning account
 * @param params.limit - Maximum rows to return
 * @throws Error on query error
 */
export async function selectLatestAccountSnapshots(params: {
  account: string;
  limit: number;
}): Promise<Tables<"playcount_snapshots">[]> {
  const { data, error } = await supabase
    .from("playcount_snapshots")
    .select("*")
    .eq("account", params.account)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(params.limit);

  if (error) {
    throw new Error(`Failed to fetch playcount_snapshots: ${error.message}`);
  }

  return data || [];
}
