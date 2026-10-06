import { afterEach, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { POST } from "../route";
const { access, verify, createArtist } = vi.hoisted(() => ({
  access: {
    accountId: "alice",
    clientId: "agent",
    grantId: "grant",
    context: "personal",
    resource: "https://api.example/mcp",
    scopes: ["mcp:read", "mcp:write"],
    expiresAt: 9999999999,
  },
  verify: vi.fn(),
  createArtist: vi.fn(async () => ({ id: "fixture-artist" })),
}));
vi.mock("@/lib/mcp/tools", () => ({
  registerAllTools: (server: McpServer) =>
    server.registerTool("legacy_key_tool", {}, async () => ({ content: [] })),
}));
vi.mock("@/lib/mcp/verifyApiKey", () => ({ verifyBearerToken: verify }));
vi.mock("@/lib/oauth/verifyOAuthBearer", () => ({ verifyOAuthBearer: async () => access }));
vi.mock("@/lib/mcp/oauth/createOAuthToolServices", () => ({
  createOAuthToolServices: () => ({
    listArtists: async () => [],
    createArtist,
    updateArtist: async () => ({}),
    getSocials: async () => [],
    getChats: async () => [],
  }),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("routes delegated credentials through actual MCP auth middleware without exposing legacy tools", async () => {
  vi.stubEnv("OAUTH_ENABLED", "true");
  vi.stubEnv("OAUTH_ISSUER", "https://api.example/api/oauth");
  verify.mockImplementation(async (_req: Request, bearer: string) =>
    bearer === "opaque-token"
      ? {
          token: bearer,
          clientId: access.clientId,
          scopes: access.scopes,
          extra: { accountId: access.accountId, oauth: access },
        }
      : undefined,
  );
  const client = new Client({ name: "route-fixture", version: "1" });
  const transport = new StreamableHTTPClientTransport(new URL(access.resource), {
    requestInit: { headers: { Authorization: "Bearer opaque-token" } },
    fetch: async (input, init) => POST(new Request(input, init)),
  });
  try {
    await client.connect(transport);
    const inventory = await client.listTools();
    expect(inventory.tools.map(tool => tool.name)).not.toContain("legacy_key_tool");
    expect(inventory.tools.map(tool => tool.name)).toContain("create_new_artist");
    expect(
      (await client.callTool({ name: "create_new_artist", arguments: { name: "Route fixture" } }))
        .isError,
    ).not.toBe(true);
    expect(createArtist).toHaveBeenCalledWith("alice", "Route fixture");
    expect(verify).toHaveBeenCalledWith(expect.any(Request), "opaque-token");
  } finally {
    await client.close();
  }
  const missing = await POST(new Request(access.resource, { method: "POST" }));
  expect(missing.status).toBe(401);
});
