/**
 * Creates a new Privy user with a linked email account.
 *
 * @param email - The email address to link to the new Privy user
 * @returns The created Privy user object
 */
export async function createPrivyUser(email: string): Promise<{ id: string }> {
  const response = await fetch("https://api.privy.io/v1/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "privy-app-id": process.env.PRIVY_APP_ID!,
      Authorization: `Basic ${btoa(process.env.PRIVY_APP_ID! + ":" + process.env.PRIVY_PROJECT_SECRET!)}`,
    },
    body: JSON.stringify({
      linked_accounts: [{ type: "email", address: email }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to create Privy user: ${response.status} ${errorBody}`);
  }

  return response.json();
}
