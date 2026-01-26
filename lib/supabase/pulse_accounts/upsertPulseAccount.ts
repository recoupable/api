import supabase from "../serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

/**
 * Upserts a pulse account record.
 * Creates a new record if one doesn't exist for the account_id,
 * or updates the existing record if one does exist.
 *
 * @param pulseAccount - The pulse account data to upsert
 * @returns The upserted pulse account record, or null if failed
 */
export async function upsertPulseAccount(
  pulseAccount: TablesInsert<"pulse_accounts">,
): Promise<Tables<"pulse_accounts"> | null> {
  const { data, error } = await supabase
    .from("pulse_accounts")
    .upsert(pulseAccount, { onConflict: "account_id" })
    .select()
    .single();

  if (error) {
    console.error("[ERROR] upsertPulseAccount:", error);
    return null;
  }

  return data;
}
