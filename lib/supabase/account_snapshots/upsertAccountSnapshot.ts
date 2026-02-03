import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";
import type { PostgrestError } from "@supabase/supabase-js";

interface UpsertAccountSnapshotParams {
  accountId: string;
  snapshotId: string;
}

interface UpsertAccountSnapshotResult {
  data: Tables<"account_snapshots"> | null;
  error: PostgrestError | null;
}

/**
 * Upserts an account snapshot record.
 * Creates a new record if one doesn't exist for the account,
 * or updates the existing record if one already exists.
 *
 * @param params - The upsert parameters
 * @param params.accountId - The account ID to associate with the snapshot
 * @param params.snapshotId - The snapshot ID to set for the account
 * @returns The upserted record or error
 */
export async function upsertAccountSnapshot({
  accountId,
  snapshotId,
}: UpsertAccountSnapshotParams): Promise<UpsertAccountSnapshotResult> {
  // Set expiration to 1 year from now
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const { data, error } = await supabase
    .from("account_snapshots")
    .upsert(
      {
        account_id: accountId,
        snapshot_id: snapshotId,
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: "account_id" },
    )
    .select("*")
    .single();

  return { data, error };
}
