import serverClient from "@/lib/supabase/serverClient";
import {
  AUTO_TOP_UP_COLUMNS,
  pickAutoTopUpRow,
  type AutoTopUpRow,
} from "@/lib/supabase/credits_usage/autoTopUpColumns";

/**
 * Reads the auto top-up settings for an account. Null when the account has no
 * `credits_usage` row yet, which the API renders as the documented defaults.
 */
export async function selectAutoTopUp(accountId: string): Promise<AutoTopUpRow | null> {
  const { data, error } = await serverClient
    .from("credits_usage")
    .select(AUTO_TOP_UP_COLUMNS as "*")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) {
    console.error("[selectAutoTopUp]", error);
    throw error;
  }

  return data ? pickAutoTopUpRow(data as unknown as Record<string, unknown>) : null;
}
