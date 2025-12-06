import { PaymentMcpServer } from "x402-mcp";
import { z } from "zod";
import { getArtistSocials } from "@/lib/artist/getArtistSocials";

/**
 * Registers the "get_artist_socials" tool on the MCP server.
 * Retrieves all social profiles associated with an artist account.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetArtistSocialsTool(server: PaymentMcpServer): void {
  server.registerTool(
    "get_artist_socials",
    {
      description:
        "Retrieve all socials associated with an artist. This endpoint should be called before using the Social Posts endpoint to obtain the necessary social IDs.",
      inputSchema: {
        // @ts-expect-error - Zod version mismatch with x402-mcp types
        artist_account_id: z.string().min(1, "Artist account ID is required") as z.ZodType<string>,
        // @ts-expect-error - Zod version mismatch with x402-mcp types
        page: z.number().int().positive().optional().default(1) as z.ZodType<number | undefined>,
        // @ts-expect-error - Zod version mismatch with x402-mcp types
        limit: z.number().int().min(1).max(100).optional().default(20) as z.ZodType<
          number | undefined
        >,
      },
    },
    async (args: { artist_account_id: string; page?: number; limit?: number }) => {
      try {
        const result = await getArtistSocials({
          artist_account_id: args.artist_account_id,
          page: args.page ?? 1,
          limit: args.limit ?? 20,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result),
            },
          ],
        };
      } catch (error) {
        console.error("Error fetching artist socials:", error);
        const errorResult = {
          success: false,
          status: "error",
          message: error instanceof Error ? error.message : "Failed to fetch artist socials",
          socials: [],
          pagination: {
            total_count: 0,
            page: 1,
            limit: 20,
            total_pages: 0,
          },
        };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(errorResult),
            },
          ],
        };
      }
    },
  );
}
