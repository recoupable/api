import { getComposioTools } from "../toolRouter/getTools";
import { ConnectorActionNotFoundError } from "./connectorActionErrors";

export interface ExecuteConnectorActionResult {
  result: unknown;
  executedAt: string;
}

/**
 * Execute a single connector action against the given account's connections.
 * Unwraps Composio's `ToolExecuteResponse` envelope so callers receive the
 * underlying provider payload (e.g. Google `youtube.channels.list` with
 * `items`); throws on `successful: false` instead of returning the envelope.
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
