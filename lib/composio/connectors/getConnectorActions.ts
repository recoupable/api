import { getComposioTools } from "../toolRouter/getTools";
import { toJsonSchema } from "./toJsonSchema";

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
 * Get the catalog of executable connector actions for an account.
 *
 * Mirrors the chat agent's tool resolution by delegating to `getComposioTools`,
 * which merges the customer's own connections (priority 1), the artist's
 * connections if scoped (priority 2), and Recoupable's shared platform-level
 * connections (priority 3). Anything in the returned catalog is executable —
 * `isConnected` is therefore `true` for every action returned.
 *
 * Each action's `slug` (UPPERCASE_SNAKE_CASE, e.g. `GOOGLEDRIVE_LIST_FILES`)
 * doubles as the `actionSlug` for `POST /api/connectors/actions`. The
 * `connectorSlug` is derived from the slug prefix.
 *
 * @param accountId - The account to scope the catalog to
 * @returns The list of executable connector actions
 */
export async function getConnectorActions(accountId: string): Promise<ConnectorAction[]> {
  const tools = await getComposioTools(accountId);

  return Object.entries(tools).map(([slug, tool]) => {
    // Derive parent toolkit from the slug prefix (Composio convention: TOOLKIT_ACTION_NAME)
    const connectorSlug = slug.split("_")[0]?.toLowerCase() ?? "";

    const t = tool as { description?: string; inputSchema?: unknown; parameters?: unknown };

    return {
      slug,
      name: slug,
      description: t.description ?? "",
      // Composio's VercelProvider uses `inputSchema`; some versions use `parameters`.
      parameters: toJsonSchema(t.inputSchema ?? t.parameters),
      connectorSlug,
      isConnected: true,
    };
  });
}
