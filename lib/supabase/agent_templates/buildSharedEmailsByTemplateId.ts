import supabase from "@/lib/supabase/serverClient";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

/**
 * Maps template id → distinct emails of accounts the template is shared with.
 * Call only for templates the caller owns (share-recipient PII).
 */
export async function buildSharedEmailsByTemplateId(
  ownerPrivateTemplateIds: string[],
): Promise<Record<string, string[]>> {
  if (ownerPrivateTemplateIds.length === 0) {
    return {};
  }

  const { data: shares, error } = await supabase
    .from("agent_template_shares")
    .select("template_id, user_id")
    .in("template_id", ownerPrivateTemplateIds);

  if (error) {
    throw error;
  }

  const userIds = [...new Set((shares ?? []).map(s => s.user_id))];
  if (userIds.length === 0) {
    return {};
  }

  const emailRows = await selectAccountEmails({ accountIds: userIds });
  const userEmailMap: Record<string, string[]> = {};
  for (const er of emailRows) {
    if (!er.account_id || !er.email) continue;
    if (!userEmailMap[er.account_id]) userEmailMap[er.account_id] = [];
    userEmailMap[er.account_id].push(er.email);
  }

  const emailsByTemplate: Record<string, string[]> = {};
  for (const s of shares ?? []) {
    if (!emailsByTemplate[s.template_id]) emailsByTemplate[s.template_id] = [];
    const add = userEmailMap[s.user_id] ?? [];
    emailsByTemplate[s.template_id].push(...add);
  }
  for (const id of Object.keys(emailsByTemplate)) {
    emailsByTemplate[id] = [...new Set(emailsByTemplate[id])];
  }

  return emailsByTemplate;
}
