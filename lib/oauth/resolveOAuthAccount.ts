import { getVerifiedOAuthIdentity } from "../privy/getVerifiedOAuthIdentity";
import { getOAuthAccountIdentity } from "../supabase/oauth_account_identities/getOAuthAccountIdentity";

/** OAuth-specific existing-account login; keeps normal app onboarding unchanged. */
export async function resolveOAuthAccount(authToken: string) {
  const identity = await getVerifiedOAuthIdentity(authToken);
  const accountId = await getOAuthAccountIdentity(identity);
  return { accountId, subject: identity.subject };
}
