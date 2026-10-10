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
        "Use list_release_cases and read_release_case to inspect saved release metadata without provider calls. review_release_case records metadata review only (reviewed or needs_changes), requires the exact current fingerprint and an idempotency key; it never approves rights or distribution. read_release_case_review retrieves an authorized historical receipt, withholding withdrawn evidence. Save reusable context from a Spotify track URL, read request progress, or compile a creative-direction/playlist-pitch evidence brief. ingest_video saves one YouTube music-video URL as an unresolved private locator: the uploading channel is never assumed to be the artist, and no captions, lyrics, recording match or artist research are collected or inferred. For brief or save_brief, use request_id and optional additional_request_ids from the same workspace to combine saved song context without recollection. save_brief also requires idempotency_key and freezes the server-compiled output; use read_brief with brief_id for exact historical output. An unavailable snapshot withholds withdrawn evidence. Briefs include bounded text, per-request coverage and an input-version manifest. Inspect gaps; audio, lyrics, artwork analysis and research may be unavailable. Never treat partial context as full song understanding.",
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
