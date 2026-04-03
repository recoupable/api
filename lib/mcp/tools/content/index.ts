import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGenerateContentImageTool } from "./registerGenerateContentImageTool";
import { registerGenerateContentVideoTool } from "./registerGenerateContentVideoTool";
import { registerGenerateContentCaptionTool } from "./registerGenerateContentCaptionTool";
import { registerTranscribeContentAudioTool } from "./registerTranscribeContentAudioTool";
import { registerEditContentTool } from "./registerEditContentTool";
import { registerUpscaleContentTool } from "./registerUpscaleContentTool";
import { registerAnalyzeContentVideoTool } from "./registerAnalyzeContentVideoTool";
import { registerListContentTemplatesTool } from "./registerListContentTemplatesTool";
import { registerCreateContentTool } from "./registerCreateContentTool";

/**
 * Registers all content-creation MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllContentTools = (server: McpServer): void => {
  registerGenerateContentImageTool(server);
  registerGenerateContentVideoTool(server);
  registerGenerateContentCaptionTool(server);
  registerTranscribeContentAudioTool(server);
  registerEditContentTool(server);
  registerUpscaleContentTool(server);
  registerAnalyzeContentVideoTool(server);
  registerListContentTemplatesTool(server);
  registerCreateContentTool(server);
};
