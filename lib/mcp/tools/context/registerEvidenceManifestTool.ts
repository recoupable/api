import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { evidenceManifestOperationSchema } from "@/lib/context/evidenceManifestSchemas";
import { processContextOperation } from "@/lib/context/processContextOperation";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";

/** Concrete discoverable schema; shares HTTP authorization and typed metadata validation. */
export function registerEvidenceManifestTool(server: McpServer) {
  const schema = evidenceManifestOperationSchema.omit({ action: true });
  server.registerTool(
    "list_context_evidence_versions",
    {
      description:
        "List up to 50 retained evidence versions for a saved request without collection. Pass returned next_id as after_id when has_more is true. Versions distinguish submitted assertions from observations and current from historical evidence; presence never proves rights. Each page rechecks access and withdrawals, and is not a frozen export or action authorization.",
      inputSchema: schema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (input, extra) => {
      try {
        const args = schema.parse(input);
        const { accountId, error } = await resolveAccountId({
          authInfo: extra.authInfo as McpAuthInfo | undefined,
          accountIdOverride: undefined,
        });
        if (error || !accountId)
          return {
            ...getToolResultError("Authentication required. Connect using a Recoup API key."),
            isError: true,
          };
        return getToolResultSuccess(
          await processContextOperation(
            accountId,
            { ...args, action: "list_evidence_versions" },
            {
              rpc: callContextRpc,
              dispatch: async () => {
                throw new Error("Evidence discovery cannot dispatch collection");
              },
            },
          ),
        );
      } catch {
        return {
          ...getToolResultError(
            "Evidence manifest unavailable. Check workspace, request and cursor access.",
          ),
          isError: true,
        };
      }
    },
  );
}
