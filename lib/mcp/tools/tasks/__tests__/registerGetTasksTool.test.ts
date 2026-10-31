import { beforeEach, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { registerGetTasksTool } from "../registerGetTasksTool";
import { registerFullOAuthTools } from "@/lib/mcp/oauth/registerFullOAuthTools";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { getTasksQuerySchema, type GetTasksQuery } from "@/lib/tasks/validateGetTasksQuery";

vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/auth/validateAccountIdOverride", () => ({ validateAccountIdOverride: vi.fn() }));
vi.mock("@/lib/admins/checkIsAdmin", () => ({ checkIsAdmin: vi.fn() }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("@/lib/mcp/tools", () => ({
  registerAllTools: (server: McpServer) => registerGetTasksTool(server),
}));

const access = {
  accountId: "owner",
  clientId: "client",
  grantId: "grant",
  scopes: ["mcp:tools"],
  expiresAt: 9999999999,
  resource: "https://example.invalid/mcp",
  context: "personal" as const,
};
const extra = {
  authInfo: {
    token: "synthetic",
    clientId: access.clientId,
    scopes: access.scopes,
    extra: { accountId: access.accountId, oauth: access },
  },
};
type Handler = (args: GetTasksQuery, context: typeof extra) => Promise<CallToolResult>;
const failure = {
  content: [
    { type: "text", text: JSON.stringify({ success: false, message: "Failed to fetch tasks" }) },
  ],
};
beforeEach(() => vi.clearAllMocks());

it.each(["standard", "delegated"])(
  "preserves success and controls selector failures: %s",
  async mode => {
    const registered = new Map<string, { schema: unknown; handler: Handler }>();
    const server = {
      registerTool: (name: string, config: { inputSchema: unknown }, handler: Handler) =>
        registered.set(name, { schema: config.inputSchema, handler }),
    };
    const verify = vi.fn().mockResolvedValue(access);
    const prepare = vi.fn(async (_name: string, args: Record<string, unknown>) => args);
    if (mode === "standard") registerGetTasksTool(server as unknown as McpServer);
    else
      registerFullOAuthTools(server as unknown as McpServer, verify, {
        prepare,
        listArtists: vi.fn(),
      });
    const { handler, schema } = registered.get("get_tasks")!;
    if (mode === "standard") expect(schema).toBe(getTasksQuerySchema);
    const args = {
      id: "task",
      artist_account_id: "artist",
      enabled: false,
      ...(mode === "standard" ? { account_id: "owner" } : {}),
    };
    const rows = [{ id: "task", account_id: "owner", enabled: false }] as Awaited<
      ReturnType<typeof selectScheduledActions>
    >;
    vi.mocked(selectScheduledActions).mockResolvedValueOnce(rows).mockResolvedValueOnce([]);
    expect(await handler(args, extra)).toEqual({
      content: [{ type: "text", text: JSON.stringify(rows) }],
    });
    expect(await handler(args, extra)).toEqual({ content: [{ type: "text", text: "[]" }] });
    expect(selectScheduledActions).toHaveBeenLastCalledWith({ ...args, account_id: "owner" });
    for (const error of [
      new Error("private database host password token"),
      "private internal failure",
    ]) {
      vi.mocked(selectScheduledActions).mockRejectedValueOnce(error);
      expect(await handler(args, extra)).toEqual(failure);
    }
    if (mode === "delegated") {
      expect(prepare).toHaveBeenCalledTimes(4);
      verify.mockResolvedValueOnce(undefined);
      expect((await handler(args, extra)).isError).toBe(true);
      expect(selectScheduledActions).toHaveBeenCalledTimes(4);
      expect(prepare).toHaveBeenCalledTimes(4);
      expect((await handler({ ...args, account_id: "foreign" }, extra)).isError).toBe(true);
      expect(selectScheduledActions).toHaveBeenCalledTimes(4);
    }
  },
);

it("returns the sanitized established error envelope through the actual MCP SDK", async () => {
  vi.mocked(selectScheduledActions).mockRejectedValue(
    new Error("private database host password token"),
  );
  const server = new McpServer({ name: "tasks-fixture", version: "1" });
  registerGetTasksTool(server);
  const client = new Client({ name: "fixture", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  try {
    expect(
      await client.callTool({ name: "get_tasks", arguments: { account_id: "owner" } }),
    ).toEqual(failure);
  } finally {
    await client.close();
    await server.close();
  }
});
