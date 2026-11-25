import { z } from "zod";
import privyClient from "./client";

const emailLink = z.object({
  type: z.literal("email"),
  address: z.string().trim().toLowerCase().email().max(320),
  latest_verified_at: z.number().int().positive(),
});

/** Read current proof of email ownership for a trusted Privy subject. */
export async function getVerifiedPrivyEmails(subject: string): Promise<string[]> {
  const account = await privyClient.users()._get(subject, { timeout: 10000, maxRetries: 1 });
  if (account.id !== subject || !Array.isArray(account.linked_accounts)) throw new Error();
  const emails = [
    ...new Set(
      account.linked_accounts.flatMap(link => {
        const parsed = emailLink.safeParse(link);
        return parsed.success ? [parsed.data.address] : [];
      }),
    ),
  ];
  if (emails.length > 20) throw new Error();
  return emails;
}
