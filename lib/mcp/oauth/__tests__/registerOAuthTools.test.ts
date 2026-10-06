import { expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { OAuthToolServices } from "../OAuthToolServices";
import { registerOAuthTools } from "../registerOAuthTools";
import type { OAuthAccess } from "../../../oauth/resolveOAuthAccess";

function fixture() {
  const access: OAuthAccess = {
    accountId: "alice",
    clientId: "agent",
    grantId: "grant",
    context: "personal",
    resource: "https://api.example/mcp",
    scopes: ["mcp:read", "mcp:write"],
    expiresAt: 9999999999,
  };
  const verify = vi.fn(async () => access as OAuthAccess | undefined);
  const services = Object.fromEntries(
    ["listArtists", "createArtist", "updateArtist", "getSocials", "getChats"].map(name => [
      name,
      vi.fn(async () => ({ success: true })),
    ]),
  ) as unknown as OAuthToolServices;
  const tools = new Map<
    string,
    {
      schema: { parse: (args: unknown) => unknown };
      call: (args: unknown, extra: unknown) => Promise<{ isError?: boolean }>;
    }
  >();
  registerOAuthTools(
    {
      registerTool: (
        name: string,
        config: { inputSchema: { parse: (args: unknown) => unknown } },
        call: (args: unknown, extra: unknown) => Promise<{ isError?: boolean }>,
      ) => {
        tools.set(name, { schema: config.inputSchema, call });
      },
    } as unknown as McpServer,
    services,
    verify,
  );
  const extra = { authInfo: { token: "opaque", extra: { accountId: "alice", oauth: access } } };
  return { tools, services, verify, access, extra };
}
it("registers only audited tools and never returns credentials or dangerous legacy tools", () => {
  const { tools } = fixture();
  expect([...tools.keys()]).toEqual([
    "list_artists",
    "create_new_artist",
    "update_account_info",
    "get_artist_socials",
    "get_chats",
  ]);
  expect(tools.has("get_api_key")).toBe(false);
});
it("binds write execution to the live account and rejects all model-supplied owner overrides", async () => {
  const { tools, services, extra } = fixture();
  const tool = tools.get("create_new_artist")!;
  for (const field of ["account_id", "organization_id", "active_conversation_id"])
    expect(() => tool.schema.parse({ name: "Artist", [field]: "other" })).toThrow();
  await tool.call(tool.schema.parse({ name: "Artist" }), extra);
  expect(services.createArtist).toHaveBeenCalledExactlyOnceWith("alice", "Artist");
});
it("rejects read-only, revoked, mismatched and absent grants before any write", async () => {
  const { tools, services, extra, access, verify } = fixture();
  const tool = tools.get("create_new_artist")!;
  for (const result of [
    undefined,
    { ...access, scopes: ["mcp:read"] },
    { ...access, accountId: "bob" },
    { ...access, grantId: "other" },
  ]) {
    verify.mockResolvedValue(result);
    expect(await tool.call({ name: "Artist" }, extra)).toHaveProperty("isError", true);
  }
  expect(await tool.call({ name: "Artist" }, {})).toHaveProperty("isError", true);
  expect(services.createArtist).not.toHaveBeenCalled();
});
