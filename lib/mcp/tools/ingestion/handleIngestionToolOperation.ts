import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { processIngestionOperation } from "@/lib/ingestion/processIngestionOperation";
import { createIngestionDependencies } from "@/lib/ingestion/createIngestionDependencies";
import { dispatchIngestionJob } from "@/lib/ingestion/dispatchIngestionJob";
import { getIngestionFailure } from "@/lib/ingestion/getIngestionFailure";

/** Execute the same scope-checked domain operation as the HTTP endpoint. */
export async function handleIngestionToolOperation(
  args: unknown,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
) {
  try {
    const authInfo = extra.authInfo as McpAuthInfo | undefined;
    if (process.env.INGESTION_ENABLED !== "true" || authInfo?.extra?.oauth) throw new Error();
    const { accountId, error } = await resolveAccountId({ authInfo, accountIdOverride: undefined });
    if (error || !accountId) throw new Error();
    return getToolResultSuccess(
      await processIngestionOperation(
        accountId,
        args,
        createIngestionDependencies(dispatchIngestionJob),
      ),
    );
  } catch (error) {
    console.error("[ingestion] MCP operation failed", {
      reason: getIngestionFailure(error).reason,
    });
    return {
      ...getToolResultError(
        "Ingestion operation unavailable. Check authentication, workspace access and operation arguments.",
      ),
      isError: true,
    };
  }
}
