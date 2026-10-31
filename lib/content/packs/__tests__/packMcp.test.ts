import { expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerFullOAuthTools } from "@/lib/mcp/oauth/registerFullOAuthTools";
import { registerAllPackTools } from "@/lib/mcp/tools/packs";
import { processPackOperation } from "../processPackOperation";
vi.mock("@/lib/mcp/resolveAccountId", () => ({
  resolveAccountId: vi.fn(async () => ({ accountId: "owner" })),
}));
vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.mock("@/lib/mcp/tools", async () => ({
  registerAllTools: (await import("@/lib/mcp/tools/packs")).registerAllPackTools,
}));
vi.mock("@/lib/content/packs/processPackOperation", async () => {
  const s = await import("../releasePackSchema");
  return {
    processPackOperation: vi.fn(),
    packOperationSchemas: {
      prepare: s.prepareReleasePackSchema,
      get: s.releasePackLocatorSchema,
      estimate: s.estimateReleasePackSchema,
      generate: s.approveReleasePackSchema,
      retry: s.retryReleasePackSchema,
      upload: s.uploadPackAssetSchema,
      export: s.releasePackLocatorSchema,
    },
  };
});

it("returns a saved-pack credit failure without a purchase or billing destination", async () => {
  vi.mocked(processPackOperation).mockRejectedValueOnce(
    new Error("Insufficient credits; your brief and quote are saved"),
  );
  const server = new McpServer({ name: "pack-commerce-test", version: "1" });
  registerAllPackTools(server);
  const client = new Client({ name: "test", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  await client.connect(ct);
  try {
    const result = await client.callTool({
      name: "get_release_pack",
      arguments: { job_id: "a1111111-1111-4111-8111-111111111111" },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      success: false,
      error: expect.stringContaining("brief and quote are saved"),
    });
    expect(JSON.stringify(result)).not.toMatch(/billingUrl|checkoutUrl|https?:/);
  } finally {
    await client.close();
    await server.close();
  }
});
it("discovers seven pack operations with explicit schemas through delegated OAuth registration", async () => {
  const server = new McpServer({ name: "pack-test", version: "1" });
  registerFullOAuthTools(server, vi.fn(), { prepare: vi.fn(), listArtists: vi.fn() });
  const client = new Client({ name: "test", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  await client.connect(ct);
  try {
    const tools = (await client.listTools()).tools.filter(tool =>
      tool.name.includes("release_pack"),
    );
    expect(tools).toHaveLength(7);
    const prepare = tools.find(tool => tool.name === "prepare_release_pack")!;
    const creative = (prepare.inputSchema.properties?.brief as any).properties.creative_context;
    expect(creative.properties.working_mode.enum).toEqual(["autonomous", "guided"]);
    expect(creative.properties.selection.properties.selected_by.enum).toEqual([
      "customer",
      "agent",
    ]);
    expect((prepare.inputSchema.properties?.brief as any).required ?? []).not.toContain(
      "creative_context",
    );
    const upload = tools.find(tool => tool.name === "upload_release_pack_asset")!;
    expect(upload._meta?.["openai/fileParams"]).toEqual(["file"]);
    expect((upload.inputSchema.properties?.file as any).required).toEqual([
      "download_url",
      "file_id",
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.properties).not.toHaveProperty("account_id");
      expect(Object.keys(tool.inputSchema.properties ?? {}).length).toBeGreaterThan(0);
    }
    expect(tools.find(t => t.name === "generate_release_pack")?.inputSchema.required).toEqual(
      expect.arrayContaining(["job_id", "quote_id", "expected_revision", "approved_max_usd"]),
    );
  } finally {
    await client.close();
    await server.close();
  }
});
