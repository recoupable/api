import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { OAuthAccess } from "../../oauth/resolveOAuthAccess";
import type { OAuthToolServices } from "./OAuthToolServices";
import type { McpAuthInfo } from "../verifyApiKey";

/** Separate allowlisted delegated server: legacy credentials and tools are never registered here. */
export function registerOAuthTools(
  server: McpServer,
  services: OAuthToolServices,
  verify: (token: string) => Promise<OAuthAccess | undefined>,
) {
  const run = async (
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    scope: string,
    operation: (accountId: string) => Promise<unknown>,
  ) => {
    try {
      const auth = extra.authInfo as McpAuthInfo | undefined;
      if (!auth?.extra?.oauth) throw new Error();
      // Recheck at execution, including revocation after the HTTP request was authenticated.
      const current = await verify(auth.token);
      if (
        !current ||
        current.grantId !== auth.extra.oauth.grantId ||
        current.accountId !== auth.extra.accountId ||
        !current.scopes.includes(scope)
      )
        throw new Error();
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(await operation(current.accountId)) },
        ],
      };
    } catch {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: "Operation unavailable or permission denied. Reconnect if access was revoked.",
          },
        ],
      };
    }
  };
  server.registerTool(
    "list_artists",
    {
      description: "List artists in your personal Recoup account.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true },
    },
    (_args, extra) => run(extra, "mcp:read", id => services.listArtists(id)),
  );
  server.registerTool(
    "create_new_artist",
    {
      description: "Create an artist in your personal Recoup account.",
      inputSchema: z.object({ name: z.string().trim().min(1).max(200) }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    (args, extra) => run(extra, "mcp:write", id => services.createArtist(id, args.name)),
  );
  server.registerTool(
    "update_account_info",
    {
      description: "Update the profile of an artist in your personal Recoup account.",
      inputSchema: z
        .object({
          artistId: z.string().uuid(),
          name: z.string().trim().min(1).max(200).optional(),
          image: z.string().url().max(2048).optional(),
          instruction: z.string().max(10000).optional(),
        })
        .strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    ({ artistId, ...updates }, extra) =>
      run(extra, "mcp:write", id => services.updateArtist(id, artistId, updates)),
  );
  server.registerTool(
    "get_artist_socials",
    {
      description: "Read social profiles for an artist in your personal Recoup account.",
      inputSchema: z.object({ artist_account_id: z.string().uuid() }).strict(),
      annotations: { readOnlyHint: true },
    },
    (args, extra) => run(extra, "mcp:read", id => services.getSocials(id, args.artist_account_id)),
  );
  server.registerTool(
    "get_chats",
    {
      description: "List your own Recoup chat conversations.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true },
    },
    (_args, extra) => run(extra, "mcp:read", id => services.getChats(id)),
  );
}
