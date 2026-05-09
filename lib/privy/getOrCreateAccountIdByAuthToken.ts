import privyClient from "./client";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { createAccountWithEmail } from "@/lib/agents/createAccountWithEmail";

/**
 * Get account ID from a Privy auth token, creating an account on the fly
 * if no row exists for the user's email yet. Mirrors `getAccountIdByAuthToken`
 * but treats "no account found" as a signal to provision rather than fail.
 *
 * Used by `GET /api/accounts/id` so that brand-new Privy users (e.g. fresh
 * sign-ins on open-agents) get a stable `accountId` on their first request
 * instead of bouncing on a 401.
 *
 * @param authToken - The Privy authentication token
 * @returns The account ID — either existing or newly-created
 */
export async function getOrCreateAccountIdByAuthToken(authToken: string): Promise<string> {
  const verified = await privyClient.utils().auth().verifyAuthToken(authToken);
  if (!verified) throw new Error("Invalid authentication token");

  const url = `https://api.privy.io/v1/users/${verified.user_id}`;
  const options = {
    method: "GET",
    headers: {
      "privy-app-id": process.env.PRIVY_APP_ID!,
      Authorization: `Basic ${btoa(
        process.env.PRIVY_APP_ID! + ":" + process.env.PRIVY_PROJECT_SECRET!,
      )}`,
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

  const email: string = emailAccount.address;

  const accountEmails = await selectAccountEmails({ emails: [email] });
  const existingAccountId = accountEmails?.[0]?.account_id;
  if (existingAccountId) {
    return existingAccountId;
  }

  return createAccountWithEmail(email);
}
