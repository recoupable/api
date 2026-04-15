import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { selectPredictions } from "@/lib/supabase/predictions/selectPredictions";

const getPredictionsSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of predictions to return (1-100, default 20)."),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of predictions to skip for pagination (default 0)."),
});

type GetPredictionsArgs = z.infer<typeof getPredictionsSchema>;

/**
 * Registers the get_predictions MCP tool on the server.
 * Lists past engagement predictions for the authenticated account.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetPredictionsTool(server: McpServer): void {
  server.registerTool(
    "get_predictions",
    {
      description:
        "List past neural engagement predictions for your account. " +
        "Returns prediction summaries (id, modality, engagement_score, created_at) " +
        "sorted by newest first. Use to compare scores across content iterations.",
      inputSchema: getPredictionsSchema,
    },
    async (
      args: GetPredictionsArgs,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { accountId, error } = await resolveAccountId({
        authInfo,
        accountIdOverride: undefined,
      });

      if (error) {
        return getToolResultError(error);
      }

      if (!accountId) {
        return getToolResultError("Failed to resolve account ID");
      }

      try {
        const predictions = await selectPredictions(accountId, args.limit, args.offset);
        return getToolResultSuccess({ predictions });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch predictions";
        return getToolResultError(message);
      }
    },
  );
}
