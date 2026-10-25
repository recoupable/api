import type { CredentialObserver } from "@/lib/auth/VerificationEvidence";
import privyClient from "./client";

/**
 * Verify a Privy access token and resolve the caller's primary email
 * by fetching their linked accounts. Single source of truth for the
 * Privy-verify + user-fetch + email-extract chain so that account-id
 * resolvers do not each duplicate the same Privy round-trip.
 *
 * @param authToken - The Privy authentication token
 * @returns The user's primary email address
 * @throws "Invalid authentication token" if token verification fails
 * @throws "Failed to fetch user data from Privy" if the user fetch fails
 * @throws "No email found in user account" if no email is linked
 */
export async function getEmailByAuthToken(
  authToken: string,
  onVerified?: CredentialObserver,
): Promise<string> {
  const verified = await privyClient.utils().auth().verifyAuthToken(authToken);
  if (!verified) throw new Error("Invalid authentication token");

  const url = `https://api.privy.io/v1/users/${verified.user_id}`;
  const options = {
    method: "GET",
    headers: {
      "privy-app-id": process.env.PRIVY_APP_ID!,
      Authorization: `Basic ${btoa(process.env.PRIVY_APP_ID! + ":" + process.env.PRIVY_PROJECT_SECRET!)}`,
    },
  };

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error("Failed to fetch user data from Privy");
  }

  const data = await response.json();

  const emailAccount = data.linked_accounts?.find(
    (account: { type: string; address?: string }) => account.type === "email",
  );
  if (!emailAccount?.address) {
    throw new Error("No email found in user account");
  }

  if (onVerified) {
    if (
      !verified.app_id ||
      verified.app_id !== process.env.PRIVY_APP_ID ||
      !verified.issuer ||
      !verified.user_id ||
      data.id !== verified.user_id
    ) {
      throw new Error("Verified identity evidence unavailable");
    }
    onVerified({
      mechanism: "privy",
      appId: verified.app_id,
      issuer: verified.issuer,
      subject: verified.user_id,
    });
  }
  return emailAccount.address;
}
