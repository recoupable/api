import privyClient from "./client";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

/**
 * Get account ID from Privy auth token
 * Verifies the token, gets the user's email from Privy, and looks up the account_id
 *
 * @param authToken - The Privy authentication token
 * @returns The account ID from the account_emails table
 */
export async function getAccountIdByAuthToken(authToken: string): Promise<string> {
  const verified = await privyClient.utils().auth().verifyAuthToken(authToken);
  if (!verified) throw new Error("Invalid authentication token");

  // Fetch user data from Privy API to get email
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

  // Extract email from linked_accounts
  const emailAccount = data.linked_accounts?.find(
    (account: { type: string; address?: string }) => account.type === "email",
  );

  if (!emailAccount?.address) {
    throw new Error("No email found in user account");
  }

  // Query account_emails table to get account_id
  const accountEmails = await selectAccountEmails({
    emails: [emailAccount.address],
  });

  if (!accountEmails || accountEmails.length === 0) {
    throw new Error("No account found for this email");
  }

  // Return the account_id from the first matching email
  const accountId = accountEmails[0].account_id;
  if (!accountId) {
    throw new Error("Account ID not found in account_emails");
  }

  return accountId;
}
