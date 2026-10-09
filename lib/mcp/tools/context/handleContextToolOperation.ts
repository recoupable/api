import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { processContextOperation } from "@/lib/context/processContextOperation";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { dispatchContextRequest } from "@/lib/context/dispatchContextRequest";
import { dispatchContextReleaseVerification } from "@/lib/context/dispatchContextReleaseVerification";
import { dispatchContextReleaseTrackIsrcs } from "@/lib/context/dispatchContextReleaseTrackIsrcs";

/** Shared authenticated handler for combined and individually discoverable Context tools. */
export async function handleContextToolOperation(
  args: unknown,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
) {
  try {
    const { accountId, error } = await resolveAccountId({
      authInfo: extra.authInfo as McpAuthInfo | undefined,
      accountIdOverride: undefined,
    });
    if (error || !accountId)
      return { ...getToolResultError(error ?? "Authentication required"), isError: true };
    return getToolResultSuccess(
      await processContextOperation(accountId, args, {
        rpc: callContextRpc,
        dispatch: dispatchContextRequest,
        dispatchRelease: dispatchContextReleaseVerification,
        dispatchReleaseTracks: dispatchContextReleaseTrackIsrcs,
      }),
    );
  } catch {
    return {
      ...getToolResultError(
        "Context operation failed. Verify access and retry using the same idempotency key.",
      ),
      isError: true,
    };
  }
}
