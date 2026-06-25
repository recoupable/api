import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { uploadPublicAsset } from "@/lib/files/uploadPublicAsset";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";

const generateTxtFileSchema = z.object({
  contents: z.string().min(1, "Contents are required").describe("The contents of the TXT file"),
});

type GenerateTxtFileArgs = z.infer<typeof generateTxtFileSchema>;

/**
 * Registers the "generate_txt_file" tool on the MCP server.
 * Uploads provided contents as a text/plain file to the public-uploads
 * Supabase bucket and returns the permanent CDN URL. The caller's accountId
 * is stamped onto the storage object's metadata for audit / takedown.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGenerateTxtFileTool(server: McpServer): void {
  server.registerTool(
    "generate_txt_file",
    {
      description:
        "Create a downloadable TXT file from provided contents. Returns a permanent CDN URL (`txtUrl`) for the stored text file.",
      inputSchema: generateTxtFileSchema,
    },
    async (
      args: GenerateTxtFileArgs,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { accountId, error: authError } = await resolveAccountId({
        authInfo,
        accountIdOverride: undefined,
      });
      if (authError) return getToolResultError(authError);
      if (!accountId) return getToolResultError("Failed to resolve account ID");

      try {
        const { url } = await uploadPublicAsset({
          data: args.contents,
          contentType: "text/plain",
          metadata: { uploaded_by: accountId },
        });

        return getToolResultSuccess({
          success: true,
          txtUrl: url,
          message: "TXT file successfully generated and stored.",
        });
      } catch (error) {
        console.error("Error generating TXT file:", error);
        return getToolResultError("Failed to generate TXT file");
      }
    },
  );
}
