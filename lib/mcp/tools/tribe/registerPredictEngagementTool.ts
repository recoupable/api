import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import {
  createPredictionBodySchema,
  type CreatePredictionBody,
} from "@/lib/tribe/validateCreatePredictionBody";
import { processPredictRequest } from "@/lib/tribe/processPredictRequest";
import { insertPrediction } from "@/lib/supabase/predictions/insertPrediction";

/**
 * Registers the predict_engagement MCP tool on the server.
 * Runs TRIBE v2 neural engagement prediction and persists the result.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerPredictEngagementTool(server: McpServer): void {
  server.registerTool(
    "predict_engagement",
    {
      description:
        "Predict neural engagement for video, audio, or text content. " +
        "Returns an engagement score (0-100), a per-timestep timeline showing where " +
        "attention peaks and drops, and brain region activation data. " +
        "Use to compare content iterations — predict v1, edit weak spots, predict v2. " +
        "Requires a publicly accessible file_url and modality (video, audio, or text).",
      inputSchema: createPredictionBodySchema,
    },
    async (
      args: CreatePredictionBody,
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

      let result;
      try {
        result = await processPredictRequest(args);
      } catch (err) {
        const message = err instanceof Error ? err.message : "An unexpected error occurred";
        return getToolResultError(`Engagement prediction failed: ${message}`);
      }

      if (result.type === "error") {
        return getToolResultError(result.error);
      }

      const { type: _, ...metrics } = result;

      try {
        const row = await insertPrediction({
          account_id: accountId,
          file_url: args.file_url,
          modality: args.modality,
          ...metrics,
        });

        return getToolResultSuccess({
          id: row.id,
          file_url: row.file_url,
          modality: row.modality,
          engagement_score: row.engagement_score,
          engagement_timeline: row.engagement_timeline,
          peak_moments: row.peak_moments,
          weak_spots: row.weak_spots,
          regional_activation: row.regional_activation,
          total_duration_seconds: row.total_duration_seconds,
          elapsed_seconds: row.elapsed_seconds,
          created_at: row.created_at,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save prediction";
        return getToolResultError(message);
      }
    },
  );
}
