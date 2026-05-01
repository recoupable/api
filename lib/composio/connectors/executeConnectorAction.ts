import { getComposioClient } from "../client";
import { ENABLED_TOOLKITS } from "../toolRouter/getTools";
import { ConnectorActionNotFoundError } from "./connectorActionErrors";

const TOOLS_LIMIT = 1000;

export interface ExecuteConnectorActionResult {
  result: unknown;
  executedAt: string;
}

/**
 * Execute a single connector action against the given account's connections.
 *
 * Bypasses the LLM tool router's customer/artist/shared merge — for a
 * single-account REST execution we just want the tools owned by that
 * account, with Composio's response envelope unwrapped.
 */
export async function executeConnectorAction(
  accountId: string,
  actionSlug: string,
  parameters: Record<string, unknown>,
): Promise<ExecuteConnectorActionResult> {
  const composio = await getComposioClient();
  const tools = (await composio.tools.get(accountId, {
    toolkits: ENABLED_TOOLKITS,
    limit: TOOLS_LIMIT,
  })) as Record<string, { execute?: (args: Record<string, unknown>) => Promise<unknown> }>;

  const tool = tools[actionSlug];
  if (!tool || typeof tool.execute !== "function") {
    throw new ConnectorActionNotFoundError(actionSlug);
  }

  const raw = await tool.execute(parameters);
  const envelope = raw as { successful?: boolean; data?: unknown; error?: string | null } | null;
  if (envelope && typeof envelope === "object" && "successful" in envelope) {
    if (!envelope.successful) {
      throw new Error(envelope.error ?? "Connector action failed");
    }
    return { result: envelope.data, executedAt: new Date().toISOString() };
  }

  return { result: raw, executedAt: new Date().toISOString() };
}
