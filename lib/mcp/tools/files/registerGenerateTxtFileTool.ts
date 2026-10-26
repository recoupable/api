import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateAndStoreTxtFile } from "@/lib/files/generateAndStoreTxtFile";
import { getFetchableUrl } from "@/lib/arweave/getFetchableUrl";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const generateTxtFileSchema = z.object({
  contents: z.string().min(1, "Contents are required").describe("The contents of the TXT file"),
});

type GenerateTxtFileArgs = z.infer<typeof generateTxtFileSchema>;

/**
 * Registers the "generate_txt_file" tool on the MCP server.
 * Creates a downloadable TXT file from provided contents and stores it in public media storage.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGenerateTxtFileTool(server: McpServer): void {
  server.registerTool(
    "generate_txt_file",
    {
      description:
        "Create a downloadable TXT file from provided contents. The file and metadata are stored publicly and returned as durable HTTPS URLs.",
      inputSchema: generateTxtFileSchema,
    },
    async (
      args: GenerateTxtFileArgs,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const { accountId: uploaderAccountId, error: authError } = await resolveAccountId({
        authInfo: extra.authInfo as McpAuthInfo | undefined,
        accountIdOverride: undefined,
      });
      if (authError || !uploaderAccountId)
        return getToolResultError(authError || "Authentication required");

      try {
        const result = await generateAndStoreTxtFile(args.contents, uploaderAccountId);

        const arweaveUrl = getFetchableUrl(result.arweave || null);

        const response = {
          success: true,
          txtUrl: result.txtUrl,
          metadataUrl: result.metadataUrl,
          // Deprecated aliases for existing clients.
          arweaveUrl,
          metadataArweave: result.metadataArweave ? getFetchableUrl(result.metadataArweave) : null,
          message: "TXT file successfully generated and stored.",
        };

        return getToolResultSuccess(response);
      } catch (error) {
        console.error("Error generating TXT file:", error);
        return getToolResultError("Failed to generate TXT file");
      }
    },
  );
}
