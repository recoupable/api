import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTranscribeAudioTool } from "./registerTranscribeAudioTool";

/**
 * Registers all transcribe-related MCP tools.
 *
 * @param server - The MCP server instance
 */
export function registerTranscribeTools(server: McpServer): void {
  registerTranscribeAudioTool(server);
}

