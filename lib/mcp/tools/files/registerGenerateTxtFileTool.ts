import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { uploadDataToPublicBucket } from "@/lib/files/uploadDataToPublicBucket";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const generateTxtFileSchema = z.object({
  contents: z.string().min(1, "Contents are required").describe("The contents of the TXT file"),
});

type GenerateTxtFileArgs = z.infer<typeof generateTxtFileSchema>;

/**
 * Registers the "generate_txt_file" tool on the MCP server.
 * Uploads provided contents as a text/plain file to the public-uploads
 * Supabase bucket and returns the permanent CDN URL.
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
    async (args: GenerateTxtFileArgs) => {
      try {
        const { url } = await uploadDataToPublicBucket({
          data: args.contents,
          contentType: "text/plain",
        });

        return getToolResultSuccess({
          success: true,
          txtUrl: url,
          message: "TXT file successfully generated and stored.",
        });
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
