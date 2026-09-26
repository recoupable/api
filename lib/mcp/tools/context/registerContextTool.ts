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
import { dispatchContextReleaseVerification } from "@/lib/context/dispatchContextReleaseVerification";
import { dispatchContextReleaseTrackIsrcs } from "@/lib/context/dispatchContextReleaseTrackIsrcs";
/** Same domain operations and ownership rules as POST /api/context. */
export function registerContextTool(server: McpServer) {
  server.registerTool(
    "context",
    {
      description:
        "Save reusable context from a Spotify track URL, read request progress, or compile a creative-direction/playlist-pitch evidence brief. For a brief, use request_id and optional additional_request_ids from the same workspace to combine saved song context without recollection. Returns bounded text, per-request coverage and an input-version manifest. Use a stable idempotency_key for ingestion retries. Inspect gaps; audio, lyrics, artwork analysis and research may be unavailable. Never treat partial context as full song understanding.",
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
            dispatchRelease: dispatchContextReleaseVerification,
            dispatchReleaseTracks: dispatchContextReleaseTrackIsrcs,
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
