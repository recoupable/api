import { ToolSet } from "ai";
import { experimental_createMCPClient as createMCPClient } from "@ai-sdk/mcp";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getBaseUrl } from "@/lib/networking/getBaseUrl";

/**
 * Fetches MCP tools via HTTP transport with authentication.
 *
 * @param authToken - The auth token to use for MCP endpoint authentication
 * @returns The MCP tools as a ToolSet
 */
export async function getMcpTools(authToken: string): Promise<ToolSet> {
  const mcpUrl = new URL("/api/mcp", getBaseUrl());
  const transport = new StreamableHTTPClientTransport(mcpUrl, {
    requestInit: {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
  });

  const mcpClient = await createMCPClient({ transport });
  return (await mcpClient.tools()) as ToolSet;
}
