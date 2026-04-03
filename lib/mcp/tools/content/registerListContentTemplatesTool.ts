import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { callContentEndpoint } from "./callContentEndpoint";

const inputSchema = z.object({});

/**
 * Registers the "list_content_templates" tool on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerListContentTemplatesTool(server: McpServer): void {
  server.registerTool(
    "list_content_templates",
    {
      description:
        "List all available content creation templates. " +
        "Templates are optional shortcuts — curated creative recipes that pre-fill parameters.",
      inputSchema,
    },
    async (
      _args: z.infer<typeof inputSchema>,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { data, error } = await callContentEndpoint(
        "/api/content/templates",
        "GET",
        undefined,
        authInfo,
      );

      if (error) return getToolResultError(error);
      return getToolResultSuccess(data);
    },
  );
}
