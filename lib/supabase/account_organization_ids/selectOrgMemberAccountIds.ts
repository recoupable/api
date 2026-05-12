import supabase from "@/lib/supabase/serverClient";

/**
 * For a given organization, returns the subset of `accountIds` that are
 * members of it. Used for batch admin checks (e.g. "which of these template
 * creators are members of the Recoup org").
 *
 * Returns an empty array on database error or empty input.
 */
export async function selectOrgMemberAccountIds(
  organizationId: string,
  accountIds: string[],
): Promise<string[]> {
  if (!organizationId || accountIds.length === 0) return [];

  const { data, error } = await supabase
    .from("account_organization_ids")
    .select("account_id")
    .eq("organization_id", organizationId)
    .in("account_id", accountIds);

  if (error) {
    console.error("Error selecting org members:", error);
    throw new Error(`selectOrgMemberAccountIds failed: ${error.message}`);
  }

  return (data ?? [])
    .map(row => row.account_id)
    .filter((id): id is string => typeof id === "string");
}
