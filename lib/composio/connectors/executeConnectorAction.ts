import { getComposioTools } from "../toolRouter/getTools";
import { ConnectorActionNotFoundError } from "./connectorActionErrors";

/**
 * Result of executing a connector action.
 */
export interface ExecuteConnectorActionResult {
  result: unknown;
  executedAt: string;
}

/**
 * Execute a single connector action with the given parameters.
 *
 * Uses the same merged customer→artist→shared tool set as the LLM tool
 * router (`getComposioTools`). When `artistId` is provided, the
 * artist's connections are reached through the artist owner scope —
 * which is critical because the customer pass applies a meta-only
 * filter, so real tools (e.g. `YOUTUBE_GET_CHANNEL_STATISTICS`) only
 * survive when fetched as artist or shared. Different artists may have
 * different connected accounts, so this scoping is required for
 * multi-tenant correctness. Composio validates parameters against the
 * action's cached schema and checks the parent toolkit's connection
 * state before invoking; failures bubble up as exceptions for the
 * handler to translate into HTTP error codes.
 *
 * @param accountId - The authenticated account (used for access checks
 *   and the customer Tool Router session)
 * @param artistId - Optional artist account whose connections should be
 *   used to satisfy the action; when omitted, only the authenticated
 *   account's customer-session tools are searched
 * @param actionSlug - UPPERCASE_SNAKE_CASE action slug (e.g.
 *   `YOUTUBE_GET_CHANNEL_STATISTICS`)
 * @param parameters - Action-specific parameters matching the action's schema
 * @returns The action's result plus an ISO 8601 server-side execution timestamp
 * @throws {ConnectorActionNotFoundError} when the slug is not in the catalog
 */
export async function executeConnectorAction(
  accountId: string,
  artistId: string | undefined,
  actionSlug: string,
  parameters: Record<string, unknown>,
): Promise<ExecuteConnectorActionResult> {
  const tools = await getComposioTools(accountId, artistId);

  const tool = tools[actionSlug] as
    | { execute?: (args: Record<string, unknown>) => Promise<unknown> }
    | undefined;

  if (!tool || typeof tool.execute !== "function") {
    throw new ConnectorActionNotFoundError(actionSlug);
  }

  const rawResult = await tool.execute(parameters);

  // Composio's ToolExecuteResponse envelope: { successful, data, error, log_id }.
  // Unwrap so callers receive the underlying provider response directly
  // (e.g. Google `youtube.channels.list` with `items`), and surface
  // upstream failures as exceptions instead of silently returning a
  // `successful: false` envelope.
  const envelope = rawResult as {
    successful?: boolean;
    data?: unknown;
    error?: string | null;
  } | null;

  if (envelope && typeof envelope === "object" && "successful" in envelope) {
    if (!envelope.successful) {
      throw new Error(envelope.error ?? "Connector action failed");
    }
    return {
      result: envelope.data,
      executedAt: new Date().toISOString(),
    };
  }

  return {
    result: rawResult,
    executedAt: new Date().toISOString(),
  };
}
