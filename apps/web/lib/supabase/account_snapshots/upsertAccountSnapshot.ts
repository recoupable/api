import supabase from "../serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";
import type { PostgrestError } from "@supabase/supabase-js";

interface UpsertAccountSnapshotResult {
  data: Tables<"account_snapshots"> | null;
  error: PostgrestError | null;
}

/**
 * Upserts an account snapshot record.
 * Creates a new record if one doesn't exist for the account,
 * or updates the existing record if one already exists.
 *
 * @param params - The upsert parameters matching the account_snapshots table schema
 * @returns The upserted record or error
 */
export async function upsertAccountSnapshot(
  params: TablesInsert<"account_snapshots">,
): Promise<UpsertAccountSnapshotResult> {
  const { data, error } = await supabase
    .from("account_snapshots")
    .upsert(params, { onConflict: "account_id" })
    .select("*")
    .single();

  return { data, error };
}
