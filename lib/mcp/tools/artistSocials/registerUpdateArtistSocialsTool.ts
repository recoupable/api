import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { updateArtistSocials } from "@/lib/artist/updateArtistSocials";
import { getSocialPlatformByLink } from "@/lib/artists/getSocialPlatformByLink";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const updateArtistSocialsSchema = z.object({
  artistId: z
    .string()
    .min(1, "Artist account ID is required")
    .describe("The artist's account ID to update socials for."),
  urls: z
    .array(z.string())
    .describe(
      "An array of social profile URLs to associate with the artist. The platform will be inferred automatically.",
    ),
});

type UpdateArtistSocialsArgs = z.infer<typeof updateArtistSocialsSchema>;

/**
 * Registers the "update_artist_socials" tool on the MCP server.
 * Updates the artist_socials records for an artist.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerUpdateArtistSocialsTool(server: McpServer): void {
  server.registerTool(
    "update_artist_socials",
    {
      description: `Update the artist_socials records for an artist. Provide the artistId and an array of social profile URLs. The tool will infer the platform for each URL and update the artist's socials accordingly.`,
      inputSchema: updateArtistSocialsSchema,
    },
    async (args: UpdateArtistSocialsArgs) => {
      try {
        // Map each URL to its platform type
        const profileUrls: Record<string, string> = {};
        for (const url of args.urls) {
          const platform = getSocialPlatformByLink(url);
          if (platform && platform !== "NONE") {
            profileUrls[platform] = url;
          }
        }

        const socials = await updateArtistSocials(args.artistId, profileUrls);

        const response = {
          success: true,
          message: "Artist socials updated successfully.",
          socials,
        };

        return getToolResultSuccess(response);
      } catch (error) {
        console.error("Error updating artist socials:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to update artist socials.";
        return getToolResultError(errorMessage);
      }
    },
  );
}
