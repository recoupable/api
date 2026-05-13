import supabase from "@/lib/supabase/serverClient";

/**
 * Returns true iff `accountId` has been granted access to `templateId` via
 * `agent_template_shares`. Throws on database error so callers can't
 * misread a query failure as "not shared" and 403 a legitimate sharee.
 */
export async function isTemplateSharedWithAccount(
  templateId: string,
  accountId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("agent_template_shares")
    .select("template_id")
    .eq("template_id", templateId)
    .eq("user_id", accountId)
    .maybeSingle();

  if (error) {
    console.error("Error checking template share:", error);
    throw new Error(`isTemplateSharedWithAccount failed: ${error.message}`);
  }

  return data !== null;
}
