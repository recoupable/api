import type { McpAuthInfo } from "../verifyApiKey";

/** Staff skills are a read entitlement independent of administrative and write permissions. */
export async function hasRecoupStaffSkills(
  accountId: string,
  auth?: McpAuthInfo,
): Promise<boolean> {
  if (!accountId || auth?.extra.oauth?.selectedContext) return false;
  if (process.env.RECOUP_STAFF_SKILL_ACCOUNT_IDS?.split(",").some(id => id.trim() === accountId))
    return true;

  try {
    const { isRecoupAdmin } = await import("@/lib/organizations/isRecoupAdmin");
    if (await isRecoupAdmin(accountId)) return true;
    const subject = auth?.extra.oauth?.subject;
    if (!subject) return false;
    const { getVerifiedPrivyEmails } = await import("@/lib/privy/getVerifiedPrivyEmails");
    const emails = await getVerifiedPrivyEmails(subject);
    return emails.some(email => email.split("@").at(-1) === "recoupable.com");
  } catch {
    return false;
  }
}
