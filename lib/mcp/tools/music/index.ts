import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerComposeMusicTool } from "./registerComposeMusicTool";
import { registerComposeDetailedMusicTool } from "./registerComposeDetailedMusicTool";
import { registerStreamMusicTool } from "./registerStreamMusicTool";
import { registerCreateCompositionPlanTool } from "./registerCreateCompositionPlanTool";
import { registerVideoToMusicTool } from "./registerVideoToMusicTool";
import { registerStemSeparationTool } from "./registerStemSeparationTool";

/**
 * Registers all ElevenLabs music MCP tools.
 *
 * @param server - The MCP server instance.
 */
export function registerAllMusicTools(server: McpServer): void {
  registerComposeMusicTool(server);
  registerComposeDetailedMusicTool(server);
  registerStreamMusicTool(server);
  registerCreateCompositionPlanTool(server);
  registerVideoToMusicTool(server);
  registerStemSeparationTool(server);
}
