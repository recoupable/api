import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { enrichEntity } from "@/lib/parallel/enrichEntity";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { deductCredits } from "@/lib/credits/deductCredits";

const schema = z.object({
  input: z.string().describe("What to research"),
  schema: z
    .record(z.string(), z.unknown())
    .describe("JSON schema defining the output fields to extract"),
  processor: z
    .enum(["base", "core", "ultra"])
    .optional()
    .default("base")
    .describe("Processing tier: base (fast), core (balanced), ultra (comprehensive)"),
});

/**
 * Registers the "research_enrich" tool on the MCP server.
 * Enriches an entity with structured data from web research using Parallel's task API.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchEnrichTool(server: McpServer): void {
  server.registerTool(
    "enrich_entity",
    {
      description:
        "Get structured data about any entity from web research. " +
        "Provide a description and a JSON schema defining what fields to extract. " +
        "Returns typed data with citations. " +
        "Use processor 'base' for fast results, 'core' for balanced, 'ultra' for comprehensive.",
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
        const result = await enrichEntity(
          args.input,
          args.schema as Record<string, unknown>,
          args.processor ?? "base",
        );
        try {
          await deductCredits({ accountId, creditsToDeduct: 5 });
        } catch {
          // Credit deduction failed but data was fetched — don't block
        }
        return getToolResultSuccess(result);
      } catch (error) {
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to enrich entity",
        );
      }
    },
  );
}
