import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerGetCatalogPlaycountHistoryTool } from "../registerGetCatalogPlaycountHistoryTool";
import { getCatalogPlaycountHistory } from "@/lib/catalog/getCatalogPlaycountHistory";
vi.mock("@/lib/catalog/getCatalogPlaycountHistory", () => ({
  getCatalogPlaycountHistory: vi.fn(async () => ({ data: { recordings: [] } })),
}));
vi.mock("@/lib/mcp/resolveAccountId", () => ({
  resolveAccountId: vi.fn(async ({ authInfo }) => ({
    accountId: authInfo?.extra?.accountId ?? null,
    error: null,
  })),
}));
const args = { catalog_id: "740d5050-40ec-4892-a040-b78bb50fef2f", since: "2026-09-03", days: 2 };
function setup() {
  const registerTool = vi.fn();
  registerGetCatalogPlaycountHistoryTool({ registerTool } as unknown as McpServer);
  return registerTool.mock.calls[0];
}
describe("catalog playcount history MCP", () => {
  it("discovers a usable schema and denies missing auth over the real SDK transport", async () => {
    const server = new McpServer({ name: "test", version: "1" });
    const client = new Client({ name: "test-client", version: "1" });
    registerGetCatalogPlaycountHistoryTool(server);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const { tools } = await client.listTools();
      expect(tools[0].inputSchema.properties).toHaveProperty("catalog_id");
      expect(tools[0].inputSchema.additionalProperties).toBe(false);
      expect(tools[0].inputSchema.properties).not.toHaveProperty("account_id");
      const result = await client.callTool({
        name: "get_catalog_playcount_history",
        arguments: args,
      });
      expect(result.isError).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });
  it("registers a concrete strict read-only schema", () => {
    const [name, config] = setup();
    expect(name).toBe("get_catalog_playcount_history");
    expect(config.inputSchema.safeParse({ ...args, account_id: args.catalog_id }).success).toBe(
      false,
    );
    expect(config.annotations.readOnlyHint).toBe(true);
  });
  it("requires validated authentication", async () => {
    vi.mocked(getCatalogPlaycountHistory).mockClear();
    const [, , handler] = setup();
    expect((await handler(args, {})).isError).toBe(true);
    expect(getCatalogPlaycountHistory).not.toHaveBeenCalled();
  });
  it("calls shared domain logic using authenticated identity", async () => {
    const [, , handler] = setup();
    const result = await handler(args, { authInfo: { extra: { accountId: "authenticated" } } });
    expect(result.isError).not.toBe(true);
    expect(getCatalogPlaycountHistory).toHaveBeenCalledWith(
      "authenticated",
      expect.objectContaining(args),
    );
  });
  it("fails closed for delegated OAuth before organization grant audit", async () => {
    vi.mocked(getCatalogPlaycountHistory).mockClear();
    const [, , handler] = setup();
    expect(
      (await handler(args, { authInfo: { extra: { accountId: "authenticated", oauth: {} } } }))
        .isError,
    ).toBe(true);
    expect(getCatalogPlaycountHistory).not.toHaveBeenCalled();
  });
});
