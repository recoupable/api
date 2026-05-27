import supabase from "@/lib/supabase/serverClient";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

/**
 * Resolves the supplied emails to account ids and upserts an
 * `agent_template_shares` row for each. Unknown emails are silently ignored.
 *
 * Throws on database error so callers can distinguish a real write failure
 * from "nothing to upsert" (the latter returns 0).
 *
 * @param templateId - The template UUID
 * @param emails - Email addresses to share with
 * @returns Number of shares upserted (pre-existing rows count as 0).
 * @throws If the Supabase upsert fails.
 */
export async function upsertAgentTemplateShares(
  templateId: string,
  emails: string[],
): Promise<number> {
  if (!Array.isArray(emails) || emails.length === 0) return 0;

  const accountEmails = await selectAccountEmails({ emails });
  const rows = accountEmails
    .filter(row => row.account_id !== null)
    .map(row => ({ template_id: templateId, user_id: row.account_id! }));

  if (rows.length === 0) return 0;

  const { data, error } = await supabase
    .from("agent_template_shares")
    .upsert(rows, {
      onConflict: "template_id,user_id",
      ignoreDuplicates: true,
    })
    .select();

  if (error) {
    console.error("Error upserting template_shares:", error);
    throw new Error(`upsertAgentTemplateShares failed: ${error.message}`);
  }

  return data?.length ?? 0;
}
