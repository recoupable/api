import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { extractUrl } from "@/lib/parallel/extractUrl";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { deductCredits } from "@/lib/credits/deductCredits";

const schema = z.object({
  urls: z.array(z.string()).max(10).describe("URLs to extract content from (max 10)"),
  objective: z.string().optional().describe("What information to focus the extraction on"),
  full_content: z
    .boolean()
    .optional()
    .describe("Return full page content instead of focused excerpts"),
});

/**
 * Registers the "research_extract" tool on the MCP server.
 * Extracts clean markdown content from public URLs using Parallel's extract API.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchExtractTool(server: McpServer): void {
  server.registerTool(
    "extract_url_content",
    {
      description:
        "Extract clean markdown content from one or more public URLs. " +
        "Handles JavaScript-heavy pages and PDFs. " +
        "Pass an objective to focus the extraction on specific information.",
      inputSchema: schema,
    },
    async (args, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { accountId, error } = await resolveAccountId({
        authInfo,
        accountIdOverride: undefined,
      });
      if (error) return getToolResultError(error);
      if (!accountId) return getToolResultError("Failed to resolve account ID");

      try {
        const result = await extractUrl(args.urls, args.objective, args.full_content ?? false);
        try {
          await deductCredits({ accountId, creditsToDeduct: 5 });
        } catch {
          // Credit deduction failed but data was fetched — don't block
        }
        return getToolResultSuccess(result);
      } catch (error) {
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to extract URL content",
        );
      }
    },
  );
}
