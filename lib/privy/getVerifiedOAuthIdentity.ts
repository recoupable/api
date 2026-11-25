import { z } from "zod";
import { InvalidAuthTokenError } from "@privy-io/node";
import privyClient from "./client";
import { OAuthIdentityError } from "./OAuthIdentityError";
import { getVerifiedPrivyEmails } from "./getVerifiedPrivyEmails";

/** Verify a Privy access token before fetching immutable subject and email-link evidence. */
export async function getVerifiedOAuthIdentity(authToken: string) {
  try {
    const appId = z.string().min(1).max(200).parse(process.env.PRIVY_APP_ID);
    if (!authToken || authToken.length > 16384) throw new OAuthIdentityError("invalid_token");
    const verified = await privyClient.utils().auth().verifyAuthToken(authToken);
    const subject = z.string().startsWith("did:privy:").max(300).parse(verified?.user_id);
    const verifiedEmails = await getVerifiedPrivyEmails(subject);
    return { appId, subject, verifiedEmails };
  } catch (error) {
    if (error instanceof OAuthIdentityError) throw error;
    // The SDK also wraps JWKS/network failures as InvalidAuthTokenError. Only
    // its explicit credential failures warrant asking the account to sign in again.
    const invalid =
      error instanceof InvalidAuthTokenError &&
      [
        "Authentication token expired",
        "Authentication token is invalid",
        "Token's payload is invalid",
      ].includes(error.message);
    throw new OAuthIdentityError(invalid ? "invalid_token" : "unavailable");
  }
}
