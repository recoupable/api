import { getVerifiedOAuthIdentity } from "../../privy/getVerifiedOAuthIdentity";
import { getOAuthAccountIdentity } from "../../supabase/oauth_account_identities/getOAuthAccountIdentity";

/** Resolve an existing account from Privy evidence, retaining verified email for claim matching. */
export async function resolveAgentClaimIdentity(bearer: string) {
  const identity = await getVerifiedOAuthIdentity(bearer);
  const accountId = await getOAuthAccountIdentity(identity);
  return { accountId, subject: identity.subject, verifiedEmails: identity.verifiedEmails };
}
