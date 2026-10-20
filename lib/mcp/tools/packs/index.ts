import { getPackOperationError } from "@/lib/content/packs/getPackOperationError";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import {
  processPackOperation,
  packOperationSchemas,
  type PackOperation,
} from "@/lib/content/packs/processPackOperation";
const tools: Record<PackOperation, [string, string]> = {
  prepare: [
    "prepare_release_pack",
    "Save or revise the compact campaign brief inline. Ask once for essential missing inputs. No existing artist, roster or repository is required. Does not generate or spend.",
  ],
  get: [
    "get_release_pack",
    "Read your saved pack, progress, QA outcomes, captions and private downloads. Poll this job; do not duplicate it.",
  ],
  estimate: [
    "estimate_release_pack",
    "Quote every creative piece, captions, inspection and composition. Pass asset_id only for a confirmed failed asset's fresh retry quote. Does not spend.",
  ],
  generate: [
    "generate_release_pack",
    "Generate the saved pack only after the customer approves its complete current quote and maximum budget. Identity comes from this connection. Does not post or publish.",
  ],
  retry: [
    "retry_release_pack",
    "Resume an accepted uncertain provider request without resubmission, or execute a fresh approved targeted retry quote for a confirmed failed asset. Never blindly retry ambiguous submissions.",
  ],
  upload: [
    "upload_release_pack_asset",
    "Import the explicitly selected file object when the host supplies it, or audio/image bytes privately: inline base64 up to 3 MiB or HTTPS source_url up to 50 MiB. For larger selected files use mode=signed_url, transfer the file with the host's upload capability, then mode=finalize to verify it. Requires no artist or API-key extraction.",
  ],
  export: [
    "export_release_pack",
    "Return your pack manifest with refreshed private download links and captions. Rejected outputs stay labeled; nothing is scheduled or published.",
  ],
};
/** Native OAuth and API-key MCP both reuse the same domain operations as REST. */
export function registerAllPackTools(server: McpServer) {
  for (const operation of Object.keys(tools) as PackOperation[]) {
    const [name, description] = tools[operation];
    server.registerTool(
      name,
      {
        description,
        inputSchema: packOperationSchemas[operation],
        ...(operation === "upload" ? { _meta: { "openai/fileParams": ["file"] } } : {}),
        annotations: {
          readOnlyHint: ["get", "export"].includes(operation),
          destructiveHint: false,
          openWorldHint: true,
        },
      },
      async (args, extra) => {
        try {
          const authInfo = extra.authInfo as McpAuthInfo | undefined;
          const resolved = await resolveAccountId({ authInfo, accountIdOverride: undefined });
          if (resolved.error || !resolved.accountId)
            return getToolResultError("Connect your Recoup account to continue this saved pack.");
          return getToolResultSuccess(
            await processPackOperation(
              resolved.accountId,
              operation,
              args,
              typeof authInfo?.extra?.orgId === "string" ? authInfo.extra.orgId : undefined,
            ),
          );
        } catch (error) {
          const failure = getPackOperationError(error);
          return {
            isError: true,
            content: [{ type: "text" as const, text: JSON.stringify(failure.body) }],
            structuredContent: failure.body,
          };
        }
      },
    );
  }
}
