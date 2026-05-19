import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

/**
 * Registers the "get_api_key" tool on the MCP server.
 *
 * Returns the Recoup API key the caller authenticated this MCP connection
 * with so the LLM can use it for direct HTTP requests to api.recoupable.com
 * (via the x-api-key header). The MCP Bearer header is opaque to the LLM by
 * design, so without this tool, skills that curl /api/* endpoints have no
 * credential to send.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetApiKeyTool(server: McpServer): void {
  server.registerTool(
    "get_api_key",
    {
      description:
        "Return the Recoup API key for this session so the LLM can use it for direct HTTP calls to api.recoupable.com (x-api-key header). Call this once when invoking any skill that makes raw HTTPS requests to the Recoup REST API — for example the recoup-api skill. The returned value is the same credential the customer used to authenticate this MCP connection.",
      inputSchema: z.object({}),
    },
    async (_args, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const token = authInfo?.token;

      if (!token) {
        return getToolResultError(
          "No authentication credential available. The MCP server must be authenticated with a Recoup API key via the Authorization: Bearer header.",
        );
      }

      return getToolResultSuccess({ api_key: token });
    },
  );
}
