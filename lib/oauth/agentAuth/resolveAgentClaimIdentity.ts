import { getVerifiedOAuthIdentity } from "../../privy/getVerifiedOAuthIdentity";
import { getOAuthAccountIdentity } from "../../supabase/oauth_account_identities/getOAuthAccountIdentity";
import { OAuthIdentityError } from "../../privy/OAuthIdentityError";
import { AgentRegistrationError } from "./AgentRegistrationError";

/** Resolve an existing account from Privy evidence, retaining verified email for claim matching. */
export async function resolveAgentClaimIdentity(bearer: string) {
  try {
    const identity = await getVerifiedOAuthIdentity(bearer);
    const accountId = await getOAuthAccountIdentity(identity);
    return { accountId, subject: identity.subject, verifiedEmails: identity.verifiedEmails };
  } catch (error) {
    if (error instanceof OAuthIdentityError && error.reason === "invalid_token")
      throw new AgentRegistrationError("login_required", 401);
    throw error;
  }
}
