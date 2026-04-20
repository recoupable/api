import supabase from "../serverClient";

export async function selectAccountSocialsBySocialId(socialId: string) {
  const { data, error } = await supabase
    .from("account_socials")
    .select("*")
    .eq("social_id", socialId);

  if (error) {
    console.error("[ERROR] selectAccountSocialsBySocialId:", error);
    throw new Error(`Failed to fetch account_socials for social_id=${socialId}: ${error.message}`);
  }

  return data ?? [];
}
