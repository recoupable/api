import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import type { PlayerOperation } from "@/lib/players/operationSchemas";
import { processPlayerOperation } from "@/lib/players/processPlayerOperation";
import { readPlayerReport } from "@/lib/players/readPlayerReport";
import { readPlayerFans } from "@/lib/players/readPlayerFans";
import { readWorkspacePlayerFans } from "@/lib/players/readWorkspacePlayerFans";
import { SiteError } from "@/lib/sites/SiteError";
export function getPlayerToolHandler(
  operation: PlayerOperation | "activity" | "fans" | "workspaceFans",
) {
  return async (args: Record<string, unknown>, extra: { authInfo?: unknown }) => {
    const resolved = await resolveAccountId({
      authInfo: extra.authInfo as McpAuthInfo | undefined,
      accountIdOverride: undefined,
    });
    if (!resolved.accountId)
      return { ...getToolResultError("Authentication required"), isError: true };
    try {
      const { id, ...query } = args;
      const result =
        operation === "workspaceFans"
          ? await readWorkspacePlayerFans(resolved.accountId, args)
          : operation === "fans"
            ? await readPlayerFans(resolved.accountId, String(id), query)
            : operation === "activity"
              ? await readPlayerReport(resolved.accountId, String(id), query)
              : await processPlayerOperation(resolved.accountId, operation, args);
      return getToolResultSuccess(result);
    } catch (error) {
      return {
        ...getToolResultError(
          error instanceof SiteError ? error.message : "Player operation unavailable",
        ),
        isError: true,
      };
    }
  };
}
