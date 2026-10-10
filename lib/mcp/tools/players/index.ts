import { readPlayerFans } from "@/lib/players/readPlayerFans";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { playerOperationSchemas, type PlayerOperation } from "@/lib/players/operationSchemas";
import { processPlayerOperation } from "@/lib/players/processPlayerOperation";
import { readPlayerReport } from "@/lib/players/readPlayerReport";
import { SiteError } from "@/lib/sites/SiteError";
import { z } from "zod";
/** Artist-agnostic player tools share the HTTP domain operations. */
export function registerAllPlayerTools(server: McpServer) {
  for (const operation of Object.keys(playerOperationSchemas) as PlayerOperation[]) {
    server.registerTool(
      `${operation}_release_player`,
      {
        description:
          operation === "create"
            ? "Register a reusable listening page and Spotify/Apple embeds for an artist in your workspace. Disabled by default; explicitly request enabled=true only when publishing is authorized. No site generation or artist-specific code needed."
            : `${operation} a release player. Updating enabled publishes/unpublishes and requires the current revision.`,
        inputSchema: playerOperationSchemas[operation],
        annotations: {
          readOnlyHint: ["get", "list"].includes(operation),
          destructiveHint: operation === "update",
          openWorldHint: true,
        },
      },
      async (args, extra) => {
        const resolved = await resolveAccountId({
          authInfo: extra.authInfo as McpAuthInfo | undefined,
          accountIdOverride: undefined,
        });
        if (!resolved.accountId)
          return { ...getToolResultError("Authentication required"), isError: true };
        try {
          return getToolResultSuccess(
            await processPlayerOperation(resolved.accountId, operation, args),
          );
        } catch (error) {
          return {
            ...getToolResultError(
              error instanceof SiteError ? error.message : "Player operation unavailable",
            ),
            isError: true,
          };
        }
      },
    );
  }
  server.registerTool(
    "get_release_player_activity",
    {
      description:
        "Read owner-scoped 30-day reported browser listening, campaign attribution and a page of fan-linked track/play/pause/skip activity. These are NOT DSP stream totals.",
      inputSchema: z.object({
        id: z.string().uuid(),
        organizationId: z.string().uuid().nullable().default(null),
        offset: z.number().int().min(0).max(100000).default(0),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args, extra) => {
      const resolved = await resolveAccountId({
        authInfo: extra.authInfo as McpAuthInfo | undefined,
        accountIdOverride: undefined,
      });
      if (!resolved.accountId)
        return { ...getToolResultError("Authentication required"), isError: true };
      try {
        return getToolResultSuccess(
          await readPlayerReport(resolved.accountId, args.id, {
            organizationId: args.organizationId,
            offset: args.offset,
          }),
        );
      } catch (error) {
        return {
          ...getToolResultError(
            error instanceof SiteError ? error.message : "Listening report unavailable",
          ),
          isError: true,
        };
      }
    },
  );
  server.registerTool(
    "get_release_player_fans",
    {
      description:
        "Read available Spotify email/profile for this artist across registered release players in the authorized workspace. Sign-in does not grant marketing consent. No provider tokens are returned.",
      inputSchema: z.object({
        id: z.string().uuid(),
        organizationId: z.string().uuid().nullable().default(null),
        offset: z.number().int().min(0).max(100000).default(0),
        limit: z.number().int().min(1).max(100).default(50),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args, extra) => {
      const resolved = await resolveAccountId({
        authInfo: extra.authInfo as McpAuthInfo | undefined,
        accountIdOverride: undefined,
      });
      if (!resolved.accountId)
        return { ...getToolResultError("Authentication required"), isError: true };
      try {
        return getToolResultSuccess(
          await readPlayerFans(resolved.accountId, args.id, {
            organizationId: args.organizationId,
            offset: args.offset,
            limit: args.limit,
          }),
        );
      } catch (error) {
        return {
          ...getToolResultError(
            error instanceof SiteError ? error.message : "Fan list unavailable",
          ),
          isError: true,
        };
      }
    },
  );
}
