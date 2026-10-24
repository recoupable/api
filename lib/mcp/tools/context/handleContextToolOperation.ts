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
import { getContextFailureReason } from "@/lib/context/getContextFailureReason";

/** Shared authenticated handler for combined and individually discoverable Context tools. */
export async function handleContextToolOperation(
  args: unknown,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
) {
  try {
    const authInfo = extra.authInfo as McpAuthInfo | undefined;
    const { accountId, error } = await resolveAccountId({
      authInfo,
      accountIdOverride: undefined,
    });
    if (error || !accountId)
      return { ...getToolResultError("Authentication required"), isError: true };
    if (
      authInfo?.extra?.oauth &&
      args &&
      typeof args === "object" &&
      "action" in args &&
      ["save_catalog_case", "read_catalog_case", "list_catalog_cases"].includes(String(args.action))
    )
      return {
        ...getToolResultError("Catalog case operations are unavailable for delegated OAuth."),
        isError: true,
      };
    return getToolResultSuccess(
      await processContextOperation(accountId, args, {
        rpc: callContextRpc,
        dispatch: dispatchContextRequest,
        dispatchRelease: dispatchContextReleaseVerification,
        dispatchReleaseTracks: dispatchContextReleaseTrackIsrcs,
        includeMaterialEvidence: !authInfo?.extra?.oauth,
      }),
    );
  } catch (error) {
    console.error("[context] MCP operation failed", { reason: getContextFailureReason(error) });
    return {
      ...getToolResultError(
        "Context operation unavailable. Check workspace access and operation arguments.",
      ),
      isError: true,
    };
  }
}
