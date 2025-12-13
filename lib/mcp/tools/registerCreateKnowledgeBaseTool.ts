import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createKnowledgeBase } from "@/lib/artist/createKnowledgeBase";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const createKnowledgeBaseSchema = z.object({
  artistId: z
    .string()
    .min(1, "Artist account ID is required")
    .describe(
      "The artist_account_id to add the knowledge base to. If not provided, check system prompt for the active artist_account_id.",
    ),
  knowledgeBaseText: z
    .string()
    .min(1, "Knowledge base text is required")
    .describe("Text to add to the knowledge base"),
});

type CreateKnowledgeBaseArgs = z.infer<typeof createKnowledgeBaseSchema>;

/**
 * Registers the "create_knowledge_base" tool on the MCP server.
 * Adds a knowledge base file to an artist by uploading text to Arweave and appending it to the artist's knowledges.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerCreateKnowledgeBaseTool(server: McpServer): void {
  server.registerTool(
    "create_knowledge_base",
    {
      description: `Adds a knowledge base file to the active artist by generating a text file and appending it to the list of existing knowledge bases. The text will be uploaded to Arweave for permanent storage.`,
      inputSchema: createKnowledgeBaseSchema,
    },
    async (args: CreateKnowledgeBaseArgs) => {
      try {
        const knowledge = await createKnowledgeBase(args.artistId, args.knowledgeBaseText);

        const response = {
          success: true,
          knowledge,
          message: "Knowledge base text prepared for creation and storage.",
        };

        return getToolResultSuccess(response);
      } catch (error) {
        console.error("Error creating knowledge base:", error);
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to create knowledge base",
        );
      }
    },
  );
}
