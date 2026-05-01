import { ToolSet } from "ai";
import { experimental_createMCPClient as createMCPClient } from "@ai-sdk/mcp";
import { getBaseUrl } from "@/lib/networking/getBaseUrl";

/**
 * Fetches MCP tools via HTTP transport with authentication.
 *
 * @param authToken - The auth token to use for MCP endpoint authentication
 * @returns The MCP tools as a ToolSet
 */
export async function getMcpTools(authToken: string): Promise<ToolSet> {
  const mcpClient = await createMCPClient({
    transport: {
      type: "http",
      url: `${getBaseUrl()}/mcp`,
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
  });

  return (await mcpClient.tools()) as ToolSet;
}
