/**
 * Get the Composio API key from the environment variables.
 *
 * @returns The Composio API key.
 */
export function getComposioApiKey(): string {
  const apiKey = process.env.COMPOSIO_API_KEY as string;

  if (!apiKey) {
    throw new Error("COMPOSIO_API_KEY not found in environment variables");
  }

  return apiKey;
}
