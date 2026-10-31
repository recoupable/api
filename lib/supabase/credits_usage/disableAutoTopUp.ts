import serverClient from "../serverClient";

/** Disable future top-ups without changing amounts, balances or creating a credits row. */
export async function disableAutoTopUp(accountId: string): Promise<void> {
  const { error } = await serverClient
    .from("credits_usage")
    .update({ auto_topup_enabled: false })
    .eq("account_id", accountId);
  if (error) throw error;
}
