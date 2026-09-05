import serverClient from "@/lib/supabase/serverClient";

interface UpdateAutoTopUpFailureParams {
  accountId: string;
  message: string;
}

/**
 * Turns auto top-up off after a failed charge and keeps the reason, so the
 * billing page can show why it stopped and the account is never retried
 * against a card that just declined.
 */
export async function updateAutoTopUpFailure({
  accountId,
  message,
}: UpdateAutoTopUpFailureParams): Promise<void> {
  const { error } = await serverClient
    .from("credits_usage")
    // Cast until `pnpm update-types` picks up database#69 (see autoTopUpColumns.ts).
    .update({ auto_topup_enabled: false, auto_topup_last_error: message })
    .eq("account_id", accountId);

  if (error) {
    console.error("[updateAutoTopUpFailure]", error);
    throw error;
  }
}
