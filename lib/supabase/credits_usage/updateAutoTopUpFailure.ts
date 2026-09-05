import serverClient from "@/lib/supabase/serverClient";

interface UpdateAutoTopUpFailureParams {
  accountId: string;
  message: string;
}

/**
 * Turns auto top-up off after a failed charge and keeps the reason, so the
 * billing page can show why it stopped and the account is never retried
 * against a card that just declined. Logs when no row matched so a silent
 * no-op never hides a still-enabled setting.
 */
export async function updateAutoTopUpFailure({
  accountId,
  message,
}: UpdateAutoTopUpFailureParams): Promise<void> {
  const { data, error } = await serverClient
    .from("credits_usage")
    .update({ auto_topup_enabled: false, auto_topup_last_error: message })
    .eq("account_id", accountId)
    .select("account_id")
    .maybeSingle();

  if (error) {
    console.error("[updateAutoTopUpFailure]", error);
    throw error;
  }
  if (!data) {
    console.error(`[updateAutoTopUpFailure] no credits_usage row for ${accountId}`);
  }
}
