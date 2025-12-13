import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { updateArtistProfile } from "@/lib/artist/updateArtistProfile";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const updateAccountInfoSchema = z.object({
  artistId: z
    .string()
    .min(1, "Artist account ID is required")
    .describe(
      "The artist_account_id to update. If not provided, check system prompt for the active artist_account_id.",
    ),
  image: z.string().optional().describe("(Optional) The new profile image URL for the artist."),
  name: z.string().optional().describe("(Optional) The display name for the artist."),
  instruction: z
    .string()
    .optional()
    .describe("(Optional) Custom instructions for the artist's account."),
  label: z.string().optional().describe("(Optional) The label or role for the artist."),
  knowledges: z
    .array(
      z.object({
        url: z.string(),
        name: z.string(),
        type: z
          .string()
          .describe(
            'MIME type of the file, e.g., "text/plain" for TXT files, "application/pdf" for PDFs',
          ),
      }),
    )
    .optional()
    .describe(
      "(Optional) Array of knowledge objects ({ url, name, type }) to be stored as the knowledge base or notes for the artist. The 'type' field must be a valid MIME type (e.g., 'text/plain' for TXT files).",
    ),
});

type UpdateAccountInfoArgs = z.infer<typeof updateAccountInfoSchema>;

/**
 * Registers the "update_account_info" tool on the MCP server.
 * Updates the account_info record for an artist.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerUpdateAccountInfoTool(server: McpServer): void {
  server.registerTool(
    "update_account_info",
    {
      description: `Update the account_info record for an artist. All fields are optional except for artistId. This tool is used to update the artist's profile image, name, instructions, label, and knowledge base. If artistId is not provided, use the active artist_account_id from the system prompt.`,
      inputSchema: updateAccountInfoSchema,
    },
    async (args: UpdateAccountInfoArgs) => {
      try {
        const artistProfile = await updateArtistProfile(
          args.artistId,
          args.image || "",
          args.name || "",
          args.instruction || "",
          args.label || "",
          args.knowledges || null,
        );

        const response = {
          success: true,
          artistProfile,
          message: `Account info updated successfully for account_id: ${artistProfile.id}`,
        };

        return getToolResultSuccess(response);
      } catch (error) {
        console.error("Error updating account info:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to update account info";
        return getToolResultError(errorMessage);
      }
    },
  );
}
