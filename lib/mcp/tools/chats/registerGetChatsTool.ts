import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { selectRooms } from "@/lib/supabase/rooms/selectRooms";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { buildGetChatsParams } from "@/lib/chats/buildGetChatsParams";

const getChatsSchema = z.object({
  account_id: z.string().optional().describe("The account ID to filter chats for."),
  artist_account_id: z.string().optional().describe("The artist account ID to filter chats for."),
});

export type GetChatsArgs = z.infer<typeof getChatsSchema>;

/**
 * Registers the "get_chats" tool on the MCP server.
 * Retrieves chat conversations (rooms) for accounts.
 *
 * For personal keys: Returns chats for the key owner's account.
 * For org keys: Returns chats for all accounts in the organization.
 * For Recoup admin key: Returns ALL chat records.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetChatsTool(server: McpServer): void {
  server.registerTool(
    "get_chats",
    {
      description: "Get chat conversations for accounts.",
      inputSchema: getChatsSchema,
    },
    async (args: GetChatsArgs, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const { account_id, artist_account_id } = args;

      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const accountId = authInfo?.extra?.accountId;
      const orgId = authInfo?.extra?.orgId ?? null;

      if (!accountId) {
        return getToolResultError(
          "Authentication required. Provide an API key via Authorization: Bearer header, or provide account_id from the system prompt context.",
        );
      }

      const { params, error } = await buildGetChatsParams({
        account_id: accountId,
        org_id: orgId,
        target_account_id: account_id,
        artist_id: artist_account_id,
      });

      if (error) {
        return getToolResultError(error);
      }

      const chats = await selectRooms(params);

      if (chats === null) {
        return getToolResultError("Failed to retrieve chats");
      }

      return getToolResultSuccess({ chats });
    },
  );
}
