import supabase from "../serverClient";

export interface SelectAccountSocialIdsResponse {
  status: "success" | "error";
  socialIds: string[];
}

/**
 * Returns the list of `social_id`s associated with a given artist account.
 *
 * This is a focused helper used by the fans query composer to resolve an
 * artist account to the set of social IDs we need to filter `social_fans` on.
 */
export async function selectAccountSocialIds(
  artistAccountId: string,
): Promise<SelectAccountSocialIdsResponse> {
  const { data, error } = await supabase
    .from("account_socials")
    .select("social_id")
    .eq("account_id", artistAccountId);

  if (error) {
    console.error("[ERROR] Error selecting account social IDs:", error);
    return { status: "error", socialIds: [] };
  }

  const socialIds = (data ?? [])
    .map(row => row.social_id)
    .filter((id): id is string => typeof id === "string");

  return { status: "success", socialIds };
}
