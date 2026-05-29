import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { selectChatsWithSessions } from "@/lib/supabase/chats/selectChatsWithSessions";
import { RECOUP_ORG_ID } from "@/lib/const";

const getChatsSchema = z.object({
  account_id: z.string().optional().describe("The account ID to filter chats for."),
  artist_account_id: z
    .string()
    .optional()
    .describe(
      "Filter chats to those for the specified artist. Currently has no effect — " +
        "the filter starts matching rows once the artist column is populated on sessions.",
    ),
});

export type GetChatsArgs = z.infer<typeof getChatsSchema>;

/**
 * Registers the "get_chats" tool on the MCP server.
 *
 * Returns chats joined with their owning session so each row carries
 * `sessionId` and the owning `accountId`. Scope mirrors GET /api/chats:
 * personal/org → caller's account; Recoup admin → all; or a specific
 * account when `account_id` is supplied and the caller can access it.
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
      const { account_id: targetAccountId } = args;

      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const accountId = authInfo?.extra?.accountId;
      const orgId = authInfo?.extra?.orgId ?? null;

      if (!accountId) {
        return getToolResultError(
          "Authentication required. Provide an API key via Authorization: Bearer header, or provide account_id from the system prompt context.",
        );
      }

      let accountIds: string[] | undefined;
      if (targetAccountId) {
        const hasAccess = await canAccessAccount({
          targetAccountId,
          currentAccountId: accountId,
        });
        if (!hasAccess) {
          return getToolResultError("Access denied to specified account_id");
        }
        accountIds = [targetAccountId];
      } else if (orgId === RECOUP_ORG_ID) {
        accountIds = undefined;
      } else {
        accountIds = [accountId];
      }

      const rows = await selectChatsWithSessions({ accountIds });
      if (rows === null) {
        return getToolResultError("Failed to retrieve chats");
      }

      const chats = rows.flatMap(row => {
        if (!row.session) return [];
        return [
          {
            id: row.id,
            title: row.title,
            accountId: row.session.account_id,
            sessionId: row.session_id,
            updatedAt: row.updated_at,
          },
        ];
      });

      return getToolResultSuccess({ chats });
    },
  );
}
