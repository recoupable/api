import supabase from "../serverClient";

export async function selectAccountSocialIds(artistAccountId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("account_socials")
    .select("social_id")
    .eq("account_id", artistAccountId)
    .limit(10000);

  if (error) {
    console.error("Error selecting account social IDs:", error);
    throw error;
  }

  return (data ?? [])
    .map(row => row.social_id)
    .filter((id): id is string => typeof id === "string");
}
