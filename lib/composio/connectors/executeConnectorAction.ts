import { getComposioClient } from "../client";
import { buildAuthConfigs } from "./buildAuthConfigs";

/**
 * Result of executing a connector action.
 */
export interface ExecuteConnectorActionResult {
  result: unknown;
  executedAt: string;
}

/**
 * Thrown when the requested action slug is not available for the account.
 * The handler maps this to a 404 response.
 */
export class ConnectorActionNotFoundError extends Error {
  constructor(slug: string) {
    super(`Connector action not found: ${slug}`);
    this.name = "ConnectorActionNotFoundError";
  }
}

/**
 * All toolkit slugs the platform supports. Mirrors getConnectors.
 */
const SUPPORTED_TOOLKITS = ["googlesheets", "googledrive", "googledocs", "tiktok", "instagram"];

/**
 * Execute a single connector action with the given parameters.
 *
 * Composio validates parameters against the action's cached schema and checks
 * the parent toolkit's connection state before invoking; failures bubble up
 * as exceptions for the handler to translate into HTTP error codes.
 *
 * @param accountId - The account whose connection should be used
 * @param actionSlug - UPPERCASE_SNAKE_CASE action slug (e.g. `GMAIL_FETCH_EMAILS`)
 * @param parameters - Action-specific parameters matching the action's schema
 * @returns The action's result plus an ISO 8601 server-side execution timestamp
 * @throws {ConnectorActionNotFoundError} when the slug is not in the catalog
 */
export async function executeConnectorAction(
  accountId: string,
  actionSlug: string,
  parameters: Record<string, unknown>,
): Promise<ExecuteConnectorActionResult> {
  const composio = await getComposioClient();
  const authConfigs = buildAuthConfigs();
  const session = await composio.create(accountId, {
    toolkits: SUPPORTED_TOOLKITS,
    ...(authConfigs && { authConfigs }),
  });

  const tools = (await session.tools()) as Record<
    string,
    { execute?: (args: Record<string, unknown>) => Promise<unknown> }
  >;

  const tool = tools[actionSlug];

  if (!tool || typeof tool.execute !== "function") {
    throw new ConnectorActionNotFoundError(actionSlug);
  }

  const result = await tool.execute(parameters);

  return {
    result,
    executedAt: new Date().toISOString(),
  };
}
