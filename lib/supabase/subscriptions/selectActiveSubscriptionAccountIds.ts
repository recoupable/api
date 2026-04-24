import supabase from "@/lib/supabase/serverClient";

/**
 * Return account_ids that currently hold an active subscription. Reads the
 * local `subscriptions` mirror rather than calling Stripe — the mirror is
 * the source of truth for cross-provider billing state (stripe,
 * lemon-squeezy, paddle) and avoids a paginated provider round-trip.
 */
export async function selectActiveSubscriptionAccountIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("account_id")
    .eq("active", true);

  if (error) {
    console.error("Error fetching active subscription account_ids:", error);
    return [];
  }

  return (data ?? []).map(row => row.account_id).filter((id): id is string => Boolean(id));
}
