import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFullOAuthTools } from "../registerFullOAuthTools";

const operation = vi.fn(async (args: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(args) }],
}));
vi.mock("../../tools", () => ({
  registerAllTools: (server: McpServer) => {
    server.registerTool(
      "get_tasks",
      { inputSchema: z.object({ account_id: z.string().optional() }) },
      operation,
    );
    server.registerTool("get_api_key", { inputSchema: z.object({}) }, operation);
  },
}));
const access = {
  accountId: "owner",
  clientId: "client",
  grantId: "grant",
  scopes: ["mcp:tools"],
  expiresAt: 9999999999,
  resource: "https://api.recoupable.dev/mcp",
  context: "personal" as const,
};
const extra = {
  authInfo: {
    token: "secret",
    clientId: "client",
    scopes: access.scopes,
    extra: { accountId: "owner", oauth: access },
  },
};
function setup(current: unknown = access) {
  const registered = new Map<string, { config: any; run: any }>();
  const server = {
    registerTool: vi.fn((name, config, run) => registered.set(name, { config, run })),
  };
  const prepare = vi.fn(async (_name: string, args: Record<string, unknown>) => args);
  registerFullOAuthTools(server as unknown as McpServer, vi.fn().mockResolvedValue(current), {
    prepare,
    listArtists: vi.fn().mockResolvedValue([]),
  });
  return { registered, prepare };
}
describe("full OAuth registry", () => {
  it("includes business tools and artist discovery, never the credential-export tool", () => {
    const { registered } = setup();
    expect([...registered.keys()].sort()).toEqual(["get_tasks", "list_artists"]);
    expect(
      registered.get("get_tasks")!.config.inputSchema.safeParse({ account_id: "victim" }).success,
    ).toBe(false);
  });
  it.each([
    undefined,
    { ...access, scopes: ["mcp:read", "mcp:write"] },
    { ...access, accountId: "victim" },
    { ...access, clientId: "other" },
    { ...access, grantId: "other" },
  ])("rejects revoked, limited, and mismatched authority", async current => {
    const { registered, prepare } = setup(current === undefined ? null : current);
    expect((await registered.get("get_tasks")!.run({}, extra)).isError).toBe(true);
    expect(prepare).not.toHaveBeenCalled();
  });
  it("binds hidden account input to the current verified caller", async () => {
    const { registered, prepare } = setup();
    await registered.get("get_tasks")!.run({}, extra);
    expect(prepare).toHaveBeenCalledWith("get_tasks", { account_id: "owner" }, "owner");
  });
});
