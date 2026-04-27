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
 * Uses the same merged customer→artist→shared tool set as the catalog
 * (`getComposioTools`) and the chat agent, so anything `GET
 * /api/connectors/actions` lists is executable here. Composio validates
 * parameters against the action's cached schema and checks the parent
 * toolkit's connection state before invoking; failures bubble up as
 * exceptions for the handler to translate into HTTP error codes.
 *
 * @param accountId - The account whose connections (and shared platform
 *   connections) should be used
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
  const tools = await getComposioTools(accountId);

  const tool = tools[actionSlug] as
    | { execute?: (args: Record<string, unknown>) => Promise<unknown> }
    | undefined;

  if (!tool || typeof tool.execute !== "function") {
    throw new ConnectorActionNotFoundError(actionSlug);
  }

  const result = await tool.execute(parameters);

  return {
    result,
    executedAt: new Date().toISOString(),
  };
}
