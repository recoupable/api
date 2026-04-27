import { getComposioClient } from "../client";
import { buildAuthConfigs } from "./buildAuthConfigs";

/**
 * A single executable action exposed by a connector.
 */
export interface ConnectorAction {
  slug: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  connectorSlug: string;
  isConnected: boolean;
}

/**
 * All toolkit slugs the platform supports. Mirrors getConnectors.
 */
const SUPPORTED_TOOLKITS = ["googlesheets", "googledrive", "googledocs", "tiktok", "instagram"];

/**
 * Get the catalog of executable connector actions for an account.
 *
 * Each action returns its slug (UPPERCASE_SNAKE_CASE, e.g. `GMAIL_FETCH_EMAILS`),
 * description, parameters JSON Schema, parent connectorSlug, and connection status
 * derived from the parent toolkit. Actions whose parent toolkit is not connected
 * are returned with `isConnected: false` and cannot be executed.
 *
 * @param accountId - The account to scope the catalog to
 * @returns The list of connector actions
 */
export async function getConnectorActions(accountId: string): Promise<ConnectorAction[]> {
  const composio = await getComposioClient();
  const authConfigs = buildAuthConfigs();
  const session = await composio.create(accountId, {
    toolkits: SUPPORTED_TOOLKITS,
    ...(authConfigs && { authConfigs }),
  });

  // Per-toolkit connection status
  const toolkits = await session.toolkits();
  const connectionByToolkit = new Map<string, boolean>();
  for (const toolkit of toolkits.items) {
    connectionByToolkit.set(toolkit.slug.toLowerCase(), toolkit.connection?.isActive ?? false);
  }

  // Tool catalog (Vercel AI SDK shape: Record<slug, { description, inputSchema, ... }>)
  const tools = await session.tools();

  return Object.entries(tools).map(([slug, tool]) => {
    // Derive parent toolkit from the slug prefix (Composio convention: TOOLKIT_ACTION_NAME)
    const connectorSlug = slug.split("_")[0]?.toLowerCase() ?? "";
    const isConnected = connectionByToolkit.get(connectorSlug) ?? false;

    const t = tool as { description?: string; inputSchema?: Record<string, unknown> };

    return {
      slug,
      name: slug,
      description: t.description ?? "",
      parameters: t.inputSchema ?? {},
      connectorSlug,
      isConnected,
    };
  });
}
