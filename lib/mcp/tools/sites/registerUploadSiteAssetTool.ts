import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { processSiteAsset } from "@/lib/sites/processSiteAsset";
import { SiteError } from "@/lib/sites/SiteError";
/** MCP upload uses the identical byte validation and ownership checks as HTTP. */
export function registerUploadSiteAssetTool(server: McpServer) {
  server.registerTool(
    "upload_site_asset",
    {
      description:
        "Upload artwork or audio bytes for a site. Maximum decoded size 4 MB. Returns a workspace-owned asset for create_site.",
      inputSchema: z
        .object({
          organizationId: z.string().uuid().nullable().optional(),
          name: z.string().min(1).max(200),
          contentType: z.enum(["image/jpeg", "image/png", "image/webp", "audio/mpeg", "audio/wav"]),
          base64: z
            .string()
            .min(1)
            .max(5592408)
            .regex(/^[A-Za-z0-9+/]+={0,2}$/),
        })
        .strict(),
    },
    async (args, extra) => {
      const { accountId } = await resolveAccountId({
        authInfo: extra.authInfo as McpAuthInfo | undefined,
        accountIdOverride: undefined,
      });
      if (!accountId) return { ...getToolResultError("Authentication required"), isError: true };
      try {
        const bytes = Buffer.from(args.base64, "base64");
        const file = new File([bytes], args.name, { type: args.contentType });
        return getToolResultSuccess(await processSiteAsset(accountId, args.organizationId, file));
      } catch (error) {
        return {
          ...getToolResultError(
            error instanceof SiteError ? error.message : "Could not upload asset",
          ),
          isError: true,
        };
      }
    },
  );
}
