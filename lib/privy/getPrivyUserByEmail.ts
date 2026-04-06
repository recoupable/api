/**
 * Looks up a Privy user by email address.
 *
 * @param email - The email address to look up
 * @returns The Privy user object if found, null if not found
 */
export async function getPrivyUserByEmail(
  email: string,
): Promise<{ id: string; custom_metadata?: Record<string, unknown> } | null> {
  const response = await fetch("https://api.privy.io/v1/users/email/address", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "privy-app-id": process.env.PRIVY_APP_ID!,
      Authorization: `Basic ${btoa(process.env.PRIVY_APP_ID! + ":" + process.env.PRIVY_PROJECT_SECRET!)}`,
    },
    body: JSON.stringify({ email }),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to get Privy user by email: ${response.status} ${errorBody}`);
  }

  return response.json();
}
