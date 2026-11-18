import { z } from "zod";
import { afterEach, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { contextToolOperations } from "@/lib/mcp/oauth/contextToolOperations";
import { selectedContextActions } from "@/lib/oauth/selectedContextActions";
import { POST } from "../route";
const { access, verify } = vi.hoisted(() => ({
  access: {
    accountId: "00000000-0000-4000-8000-000000000001",
    clientId: "agent",
    grantId: "grant",
    context: "personal",
    resource: "https://api.example/mcp",
    scopes: ["mcp:tools"],
    expiresAt: 9999999999,
    selectedContext: {
      version: 1,
      capabilityVersion: "context-workspace-v1",
      mode: "selected_context",
      kind: "personal",
      ownerId: "00000000-0000-4000-8000-000000000001",
      organizationId: null,
    },
  },
  verify: vi.fn(),
}));
vi.mock("@/lib/mcp/tools", () => ({
  registerAllTools: (server: McpServer) => {
    server.registerTool("get_tasks", { inputSchema: z.object({}) }, async () => ({ content: [] }));
    server.registerTool(
      "context",
      {
        inputSchema: z.discriminatedUnion("action", [
          z.object({ action: z.literal("read") }),
          z.object({ action: z.literal("save_brief") }),
        ]),
      },
      async () => ({ content: [] }),
    );
  },
}));
vi.mock("@/lib/mcp/oauth/createFullOAuthToolServices", () => ({
  createFullOAuthToolServices: () => ({
    prepare: async (_name: string, args: unknown) => args,
    listArtists: async () => [],
  }),
}));
vi.mock("@/lib/mcp/verifyApiKey", () => ({ verifyBearerToken: verify }));
vi.mock("@/lib/oauth/verifyOAuthBearer", () => ({ verifyOAuthBearer: async () => access }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("routes selected grants to Context-only discovery without Explore", async () => {
  vi.stubEnv("OAUTH_ENABLED", "true");
  vi.stubEnv("OAUTH_ISSUER", "https://api.example/api/oauth");
  verify.mockImplementation(async (_req: Request, token: string) => ({
    token,
    clientId: access.clientId,
    scopes: access.scopes,
    extra: { accountId: access.accountId, oauth: access },
  }));
  const client = new Client({ name: "selected-route-fixture", version: "1" });
  const transport = new StreamableHTTPClientTransport(new URL(access.resource), {
    requestInit: { headers: { Authorization: "Bearer selected-token" } },
    fetch: async (input, init) => POST(new Request(input, init)),
  });
  try {
    await client.connect(transport);
    const inventory = await client.listTools();
    expect(inventory.tools.map(tool => tool.name).sort()).toEqual(
      [contextToolOperations.read.name, contextToolOperations.save_brief.name].sort(),
    );
    expect(selectedContextActions.has("read")).toBe(true);
    await expect(client.readResource({ uri: "ui://recoup/explore.html" })).rejects.toThrow();
    expect(verify).toHaveBeenCalledWith(expect.any(Request), "selected-token");
  } finally {
    await client.close();
  }
});
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("@/lib/mcp/oauth/createOAuthToolServices", () => ({
  createOAuthToolServices: () => ({
    listArtists: async () => [],
    createArtist: async () => ({}),
    updateArtist: async () => ({}),
    getSocials: async () => [],
    getChats: async () => [],
  }),
}));
