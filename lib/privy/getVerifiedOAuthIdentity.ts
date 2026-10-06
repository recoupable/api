import { z } from "zod";
import privyClient from "./client";

const emailLink = z.object({
  type: z.literal("email"),
  address: z.string().trim().toLowerCase().email().max(320),
  // Do not treat imported/profile email attributes as proof of an authenticated email link.
  latest_verified_at: z.number().int().positive(),
});

/** Verify a Privy access token before fetching immutable subject and email-link evidence. */
export async function getVerifiedOAuthIdentity(authToken: string) {
  try {
    const appId = z.string().min(1).max(200).parse(process.env.PRIVY_APP_ID);
    if (!authToken || authToken.length > 16384) throw new Error();
    const verified = await privyClient.utils().auth().verifyAuthToken(authToken);
    const subject = z.string().startsWith("did:privy:").max(300).parse(verified?.user_id);
    const account = await privyClient.users()._get(subject, { timeout: 10000, maxRetries: 1 });
    if (account.id !== subject || !Array.isArray(account.linked_accounts)) throw new Error();
    const verifiedEmails = [
      ...new Set(
        account.linked_accounts.flatMap(link => {
          const parsed = emailLink.safeParse(link);
          return parsed.success ? [parsed.data.address] : [];
        }),
      ),
    ];
    if (verifiedEmails.length > 20) throw new Error();
    return { appId, subject, verifiedEmails };
  } catch {
    throw new Error("Unable to verify OAuth identity");
  }
}
