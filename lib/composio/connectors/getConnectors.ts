import { getComposioClient } from "../client";

/**
 * Connector info returned by Composio.
 */
export interface ConnectorInfo {
  slug: string;
  name: string;
  isConnected: boolean;
  connectedAccountId?: string;
}

/**
 * Get all connectors and their connection status for a user.
 *
 * @param userId - The user's account ID
 * @returns List of connectors with connection status
 */
export async function getConnectors(userId: string): Promise<ConnectorInfo[]> {
  const composio = getComposioClient();
  const session = await composio.create(userId);
  const toolkits = await session.toolkits();

  return toolkits.items.map((toolkit) => ({
    slug: toolkit.slug,
    name: toolkit.name,
    isConnected: toolkit.connection?.isActive ?? false,
    connectedAccountId: toolkit.connection?.connectedAccount?.id,
  }));
}
