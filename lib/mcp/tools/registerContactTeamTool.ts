import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { contactTeam } from "@/lib/contact/contactTeam";
import {
  contactTeamQuerySchema,
  type ContactTeamQuery,
} from "@/lib/contact/validateContactTeamQuery";

/**
 * Registers the "contact_team" tool on the MCP server.
 * Send a message to the team. Use this when users need to contact support or have questions for the team.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerContactTeamTool(server: McpServer): void {
  server.registerTool(
    "contact_team",
    {
      description:
        "Send a message to the team. Use this when users need to contact support or have questions for the team.",
      inputSchema: contactTeamQuerySchema,
    },
    async (args: ContactTeamQuery) => {
      const result = await contactTeam(args);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
      };
    },
  );
}

