import { CatalogSnapshotTooLargeError } from "@/lib/context/CatalogSnapshotTooLargeError";
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
import { catalogCaseToolOperations } from "@/lib/mcp/oauth/catalogCaseToolOperations";
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
      Object.hasOwn(catalogCaseToolOperations, String(args.action)) &&
      catalogCaseToolOperations[String(args.action) as keyof typeof catalogCaseToolOperations]
        .delegated === false
    )
      return {
        ...getToolResultError("Catalog case operations are unavailable for delegated OAuth."),
        isError: true,
      };
    if (authInfo?.extra.oauth?.selectedContext && !authInfo.extra.selectedContextAuthorize)
      throw new Error("Selected Context authority required");
    return getToolResultSuccess(
      await processContextOperation(accountId, args, {
        rpc: callContextRpc,
        dispatch: dispatchContextRequest,
        dispatchRelease: dispatchContextReleaseVerification,
        dispatchReleaseTracks: dispatchContextReleaseTrackIsrcs,
        ...(authInfo?.extra.oauth?.selectedContext
          ? { authorize: authInfo.extra.selectedContextAuthorize }
          : {}),
        includeMaterialEvidence: !authInfo?.extra?.oauth,
      }),
    );
  } catch (error) {
    if (error instanceof CatalogSnapshotTooLargeError)
      return { ...getToolResultError(error.message), isError: true };
    console.error("[context] MCP operation failed", { reason: getContextFailureReason(error) });
    return {
      ...getToolResultError(
        "Context operation unavailable. Check workspace access and operation arguments.",
      ),
      isError: true,
    };
  }
}
