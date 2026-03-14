import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import {
  processCompactChatRequest,
  CompactChatProcessResult,
} from "@/lib/chats/processCompactChatRequest";
import type { CompactChatResult } from "@/lib/chats/compactChat";

const compactChatsSchema = z.object({
  chat_id: z.array(z.string()).min(1).describe("Array of chat IDs to compact into summaries."),
  prompt: z
    .string()
    .optional()
    .describe("Optional custom prompt to guide which details are retained in the summary."),
});

export type CompactChatsArgs = z.infer<typeof compactChatsSchema>;

/**
 * Registers the "compact_chats" tool on the MCP server.
 * Compacts one or more chat conversations into summarized versions.
 *
 * Uses the same shared logic as POST /api/chats/compact endpoint.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerCompactChatsTool(server: McpServer): void {
  server.registerTool(
    "compact_chats",
    {
      description:
        "Compact one or more chat conversations into concise summaries. Useful for creating a condensed version of long conversations that preserves key information, decisions, and action items.",
      inputSchema: compactChatsSchema,
    },
    async (
      args: CompactChatsArgs,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const { chat_id: chatIds, prompt } = args;

      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const accountId = authInfo?.extra?.accountId;
      const orgId = authInfo?.extra?.orgId ?? null;

      if (!accountId) {
        return getToolResultError(
          "Authentication required. Provide an API key via Authorization: Bearer header.",
        );
      }

      if (!chatIds || chatIds.length === 0) {
        return getToolResultError("chat_id array must contain at least one ID.");
      }

      // Process all chats in parallel using the shared domain function
      const processResults: CompactChatProcessResult[] = await Promise.all(
        chatIds.map(chatId =>
          processCompactChatRequest({
            chatId,
            prompt,
            accountId,
            orgId: orgId ?? undefined,
          }),
        ),
      );

      // Separate results and not-found IDs
      const results: CompactChatResult[] = [];
      const notFoundIds: string[] = [];

      for (const processResult of processResults) {
        if (processResult.type === "notFound") {
          notFoundIds.push(processResult.chatId);
        } else if (processResult.result) {
          results.push(processResult.result);
        }
      }

      // If any chats were not found or not accessible, return error
      if (notFoundIds.length > 0) {
        return getToolResultError(`Chat(s) not found or not accessible: ${notFoundIds.join(", ")}`);
      }

      return getToolResultSuccess({ chats: results });
    },
  );
}
