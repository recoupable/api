import { beforeEach, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFullOAuthTools } from "../registerFullOAuthTools";
import { registerGetCatalogSongsTool } from "../../tools/catalogs/registerGetCatalogSongsTool";

const mocks = vi.hoisted(() => ({ analyze: vi.fn() }));
vi.mock("@/lib/catalog/analyzeFullCatalog", () => ({ analyzeFullCatalog: mocks.analyze }));
vi.mock("@/lib/mcp/resolveAccountId", () => ({ resolveAccountId: vi.fn() }));
vi.mock("../../tools", async () => {
  const { registerGetCatalogSongsTool } = await import(
    "../../tools/catalogs/registerGetCatalogSongsTool"
  );
  return { registerAllTools: registerGetCatalogSongsTool };
});
beforeEach(() => vi.clearAllMocks());

it.each([false, true])("describes AI selection boundaries with OAuth=%s", oauth => {
  const registerTool = vi.fn();
  const server = { registerTool } as unknown as McpServer;
  if (oauth) registerFullOAuthTools(server, vi.fn(), { prepare: vi.fn(), listArtists: vi.fn() });
  else registerGetCatalogSongsTool(server);
  const config = registerTool.mock.calls.find(([name]) => name === "select_catalog_songs")![1];
  expect(config.description).toContain("catalog candidates");
  expect(config.description).toContain("AI provider");
  expect(config.description).toContain("ISRCs, song names, artist names, and your criteria");
  expect(config.description).toContain("up to 100 songs per model call");
  expect(config.description).toContain(
    "All batches are analyzed before the 1,000-match output cap",
  );
  expect(config.description).toContain("catalog order, not relevance rank");
  expect(config.description).toContain("Read-only does not mean free");
  expect(config.description).toContain("Repeated calls can repeat provider work and cost");
  expect(config.description).toContain("billing idempotency is not established");
  expect(config.description).toContain(
    "Charges, approval requirements, spending ceilings, and retry handling remain unmeasured or unapproved",
  );
  expect(config.description).toContain("does not establish licensing clearance");
  expect(config.description).toContain("does not authorize spending or use of a song");
  expect(config.description).not.toMatch(/ALWAYS|MANDATORY|can actually be used/);
  expect(Object.keys(config.inputSchema.shape)).toEqual(["catalog_id", "criteria"]);
  expect(config.inputSchema.safeParse({ catalog_id: "catalog", criteria: "theme" }).success).toBe(
    true,
  );
  expect(config.inputSchema.safeParse({ catalog_id: "", criteria: "theme" }).success).toBe(false);
  expect(config.inputSchema.safeParse({ catalog_id: "catalog", criteria: "" }).success).toBe(false);
  if (oauth)
    expect(config.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
  expect(mocks.analyze).not.toHaveBeenCalled();
});

it("preserves the real registered callback arguments and result envelope", async () => {
  const registerTool = vi.fn();
  registerGetCatalogSongsTool({ registerTool } as unknown as McpServer);
  const response = { results: [{ isrc: "saved-isrc" }], totalSongs: 250, totalPages: 3 };
  mocks.analyze.mockResolvedValue(response);
  const result = await registerTool.mock.calls[0][2]({ catalog_id: "catalog", criteria: "theme" });
  expect(mocks.analyze).toHaveBeenCalledExactlyOnceWith({
    catalogId: "catalog",
    criteria: "theme",
  });
  expect(result).toEqual({ content: [{ type: "text", text: JSON.stringify(response) }] });
});
