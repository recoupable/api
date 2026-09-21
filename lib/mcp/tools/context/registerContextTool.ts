import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import {
  contextOperationSchema,
  processContextOperation,
} from "@/lib/context/processContextOperation";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { dispatchContextRequest } from "@/lib/context/dispatchContextRequest";
/** Same domain operations and ownership rules as POST /api/context. */
export function registerContextTool(server: McpServer) {
  server.registerTool(
    "context",
    {
      description:
        "Save reusable context from a Spotify track URL, read request progress, or select a creative-direction/playlist-pitch brief. Use a stable idempotency_key for retries. Metadata pilot: inspect gaps; audio, lyrics, artwork analysis and research may be unavailable. Never treat partial context as full song understanding.",
      inputSchema: contextOperationSchema,
    },
    async (args, extra) => {
      const { accountId, error } = await resolveAccountId({
        authInfo: extra.authInfo as McpAuthInfo | undefined,
        accountIdOverride: undefined,
      });
      if (error || !accountId) return getToolResultError(error ?? "Authentication required");
      try {
        return getToolResultSuccess(
          await processContextOperation(accountId, args, {
            rpc: callContextRpc,
            dispatch: dispatchContextRequest,
          }),
        );
      } catch {
        return getToolResultError(
          "Context operation failed. Verify access and retry using the same idempotency key.",
        );
      }
    },
  );
}
