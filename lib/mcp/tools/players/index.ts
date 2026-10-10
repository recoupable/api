import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCreateReleasePlayerTool } from "./registerCreateReleasePlayerTool";
import { registerListReleasePlayerTool } from "./registerListReleasePlayerTool";
import { registerGetReleasePlayerTool } from "./registerGetReleasePlayerTool";
import { registerUpdateReleasePlayerTool } from "./registerUpdateReleasePlayerTool";
import { registerGetReleasePlayerActivityTool } from "./registerGetReleasePlayerActivityTool";
import { registerGetReleasePlayerFansTool } from "./registerGetReleasePlayerFansTool";
import { registerGetWorkspacePlayerFansTool } from "./registerGetWorkspacePlayerFansTool";
/** Explicit tool registrations keep OAuth inventory and publication policy reviewable. */
export function registerAllPlayerTools(server: McpServer) {
  registerCreateReleasePlayerTool(server);
  registerListReleasePlayerTool(server);
  registerGetReleasePlayerTool(server);
  registerUpdateReleasePlayerTool(server);
  registerGetReleasePlayerActivityTool(server);
  registerGetReleasePlayerFansTool(server);
  registerGetWorkspacePlayerFansTool(server);
}
