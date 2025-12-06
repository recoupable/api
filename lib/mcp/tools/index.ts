import { PaymentMcpServer } from "x402-mcp";
import { registerAddTool } from "./registerAddTool";
import { registerGetRandomNumberTool } from "./registerGetRandomNumberTool";
import { registerHelloRemoteTool } from "./registerHelloRemoteTool";
import { registerGetArtistSocialsTool } from "./registerGetArtistSocialsTool";

/**
 * Registers all MCP tools on the server.
 * Add new tools here to automatically register them.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllTools = (server: PaymentMcpServer): void => {
  registerGetRandomNumberTool(server);
  registerAddTool(server);
  registerHelloRemoteTool(server);
  registerGetArtistSocialsTool(server);
};
