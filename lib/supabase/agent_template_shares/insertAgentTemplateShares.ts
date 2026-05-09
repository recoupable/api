import supabase from "@/lib/supabase/serverClient";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

/**
 * Resolves the supplied emails to account ids and upserts an
 * `agent_template_shares` row for each. Unknown emails are silently ignored.
 *
 * @param templateId - The agent template UUID
 * @param emails - Email addresses to share with
 * @returns Number of shares inserted (counts pre-existing rows as 0).
 */
export async function insertAgentTemplateShares(
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
    console.error("Error inserting agent_template_shares:", error);
    return 0;
  }

  return data?.length ?? 0;
}
