import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { selectTemplateShares } from "@/lib/supabase/template_shares/selectTemplateShares";

/**
 * For each supplied template id, returns the list of emails it has been
 * shared with — by joining `template_shares` to `account_emails`. Empty
 * input returns an empty map.
 */
export async function resolveSharedEmails(
  templateIds: string[],
): Promise<Record<string, string[]>> {
  if (templateIds.length === 0) return {};

  const shares = await selectTemplateShares(templateIds);
  if (shares.length === 0) return {};

  const accountIds = Array.from(new Set(shares.map(s => s.user_id)));
  const accountEmails = await selectAccountEmails({ accountIds });

  const emailsByAccount = new Map<string, string[]>();
  accountEmails.forEach(row => {
    if (!row.account_id || !row.email) return;
    const list = emailsByAccount.get(row.account_id) ?? [];
    list.push(row.email);
    emailsByAccount.set(row.account_id, list);
  });

  const result: Record<string, string[]> = {};
  shares.forEach(share => {
    const list = result[share.template_id] ?? [];
    list.push(...(emailsByAccount.get(share.user_id) ?? []));
    result[share.template_id] = list;
  });
  Object.keys(result).forEach(id => {
    result[id] = Array.from(new Set(result[id]));
  });
  return result;
}
