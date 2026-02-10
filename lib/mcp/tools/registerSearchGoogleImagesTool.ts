import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchGoogleImages } from "@/lib/serpapi/searchGoogleImages";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const searchGoogleImagesSchema = z.object({
  query: z
    .string()
    .min(1, "Search query is required")
    .describe(
      "The search query (e.g., 'Mac Miller concert', 'Wiz Khalifa album cover'). Be specific for best results.",
    ),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Number of images to return (1-100, default: 8)."),
  imageSize: z
    .enum(["l", "m", "i"])
    .optional()
    .describe(
      "Image size: 'l' (large, recommended), 'm' (medium), 'i' (icon/small). Leave unset if unsure.",
    ),
  imageType: z
    .enum(["photo", "clipart", "lineart", "animated"])
    .optional()
    .describe(
      "Type of image: 'photo' (default, recommended), 'clipart', 'lineart', 'animated'. Leave unset if unsure.",
    ),
  aspectRatio: z
    .enum(["square", "wide", "tall", "panoramic"])
    .optional()
    .describe(
      "Aspect ratio filter. Only use if specifically requested. Leave unset for general searches.",
    ),
});

type SearchGoogleImagesArgs = z.infer<typeof searchGoogleImagesSchema>;

/**
 * Registers the "search_google_images" tool on the MCP server.
 * Searches Google Images via SerpAPI for existing photos and visual content.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerSearchGoogleImagesTool(server: McpServer): void {
  server.registerTool(
    "search_google_images",
    {
      description:
        "Search for EXISTING images on Google Images. Use this to FIND real photos, not create new ones.\n\n" +
        "Use this tool when the user wants to:\n" +
        "- FIND existing photos of artists, concerts, album covers, or events\n" +
        "- SEE what something looks like (e.g., 'show me photos of Mac Miller', 'find concert images')\n" +
        "- GET reference images or inspiration from real photos\n" +
        "- SEARCH for visual content that already exists online\n\n" +
        "DO NOT use this tool when the user wants to:\n" +
        "- CREATE, GENERATE, or MAKE new images (use generate_image instead)\n" +
        "- DESIGN custom album covers or artwork (use generate_image tools)\n" +
        "- EDIT existing images (use edit_image instead)\n\n" +
        "Key distinction: This finds what EXISTS, generative tools create what DOESN'T exist yet.\n\n" +
        "Returns thumbnails and full-resolution URLs for displaying in chat or emails.\n\n" +
        "TECHNICAL NOTES: Keep parameters simple. Query is most important. Optional filters can cause errors - if tool fails, retry with just query and limit.",
      inputSchema: searchGoogleImagesSchema,
    },
    async (args: SearchGoogleImagesArgs) => {
      const { query, limit = 8, imageSize, imageType, aspectRatio } = args;

      try {
        const response = await searchGoogleImages({
          query,
          limit,
          imageSize,
          imageType,
          aspectRatio,
        });

        const images = (response.images_results || []).map(img => ({
          position: img.position,
          thumbnail: img.thumbnail,
          original: img.original,
          width: img.original_width,
          height: img.original_height,
          title: img.title,
          source: img.source,
          link: img.link,
        }));

        return getToolResultSuccess({
          success: true,
          query,
          total_results: images.length,
          images,
          message: `Found ${images.length} images for "${query}"`,
        });
      } catch (error) {
        return getToolResultError(
          error instanceof Error
            ? `Google Images search failed: ${error.message}`
            : "Failed to search Google Images",
        );
      }
    },
  );
}
