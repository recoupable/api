import { getComposioClient } from "../client";
import { insertArtistComposioConnection } from "@/lib/supabase/artist_composio_connections/insertArtistComposioConnection";

/**
 * Result of completing an artist connector OAuth flow.
 */
export interface CompleteArtistConnectorResult {
  success: boolean;
  connectedAccountId: string;
}

/**
 * Complete the OAuth flow for an artist connector.
 *
 * Why: After OAuth redirect, we need to query Composio for the newly
 * created connection and store the mapping in our database.
 *
 * @param accountId - The user's account ID (Composio entity)
 * @param artistId - The artist ID to associate the connection with
 * @param toolkitSlug - The toolkit slug (e.g., "tiktok")
 * @returns The result with the connected account ID
 * @throws Error if connection not found or database insert fails
 */
export async function completeArtistConnector(
  accountId: string,
  artistId: string,
  toolkitSlug: string,
): Promise<CompleteArtistConnectorResult> {
  const composio = await getComposioClient();

  // Create a session for the user to query their connections
  const session = await composio.create(accountId);

  // Get all toolkits to find the connected one
  const toolkits = await session.toolkits();

  // Find the toolkit matching the slug
  const toolkit = toolkits.items.find((t) => t.slug === toolkitSlug);

  if (!toolkit || !toolkit.connection?.isActive || !toolkit.connection?.connectedAccount?.id) {
    throw new Error(`No active connection found for toolkit '${toolkitSlug}'`);
  }

  const connectedAccountId = toolkit.connection.connectedAccount.id;

  // Store the mapping in our database
  const { error } = await insertArtistComposioConnection({
    artist_id: artistId,
    toolkit_slug: toolkitSlug,
    connected_account_id: connectedAccountId,
  });

  if (error) {
    throw new Error("Failed to save connection to database");
  }

  return {
    success: true,
    connectedAccountId,
  };
}
