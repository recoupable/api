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
 * Creates a downloadable TXT file from provided contents and stores it on Arweave.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGenerateTxtFileTool(server: McpServer): void {
  server.registerTool(
    "generate_txt_file",
    {
      description:
        "Create a downloadable TXT file from provided contents. The file will be stored onchain with Arweave and metadata will be created.",
      inputSchema: generateTxtFileSchema,
    },
    async (args: GenerateTxtFileArgs) => {
      try {
        const result = await generateAndStoreTxtFile(args.contents);

        const arweaveUrl = getFetchableUrl(result.arweave || null);

        const response = {
          success: true,
          arweaveUrl,
          metadataArweave: result.metadataArweave ? getFetchableUrl(result.metadataArweave) : null,
          message: "TXT file successfully generated and stored on Arweave.",
        };

        return getToolResultSuccess(response);
      } catch (error) {
        console.error("Error generating TXT file:", error);

        // Format helpful error messages based on common issues
        let errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";

        if (errorMessage.includes("API key")) {
          errorMessage = "API key is missing or invalid. Please check your environment variables.";
        } else if (errorMessage.includes("content policy")) {
          errorMessage = "Your contents may violate content policy. Please try different contents.";
        } else if (errorMessage.includes("rate limit")) {
          errorMessage = "Rate limit exceeded. Please try again later.";
        }

        return getToolResultError(`Failed to generate TXT file. ${errorMessage}`);
      }
    },
  );
}
