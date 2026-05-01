/**
 * Sets custom metadata on a Privy user.
 *
 * @param userId - The Privy user ID
 * @param metadata - The custom metadata to set
 */
export async function setPrivyCustomMetadata(
  userId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`https://api.privy.io/v1/users/${userId}/custom_metadata`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "privy-app-id": process.env.PRIVY_APP_ID!,
      Authorization: `Basic ${btoa(process.env.PRIVY_APP_ID! + ":" + process.env.PRIVY_PROJECT_SECRET!)}`,
    },
    body: JSON.stringify({ custom_metadata: metadata }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to set Privy custom metadata: ${response.status} ${errorBody}`);
  }
}
