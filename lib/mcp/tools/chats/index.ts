import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetChatsTool } from "./registerGetChatsTool";

/**
 * Registers all chat-related MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllChatsTools = (server: McpServer): void => {
  registerGetChatsTool(server);
};
