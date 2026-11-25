import { beforeEach, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFullOAuthTools } from "../registerFullOAuthTools";
import { registerGetCatalogSongsTool } from "../../tools/catalogs/registerGetCatalogSongsTool";

const mocks = vi.hoisted(() => ({ analyze: vi.fn(), catalogs: vi.fn() }));
vi.mock("@/lib/catalog/analyzeFullCatalog", () => ({ analyzeFullCatalog: mocks.analyze }));
vi.mock("@/lib/mcp/resolveAccountId", () => ({
  resolveAccountId: vi.fn().mockResolvedValue({ accountId: "account", error: null }),
}));
vi.mock("@/lib/catalog/getCatalogOwnerIds", () => ({
  getCatalogOwnerIds: vi.fn().mockResolvedValue(["account"]),
}));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalogs", () => ({
  selectAccountCatalogs: mocks.catalogs,
}));
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
  expect(config.title).toBe("Find Matching Catalog Tracks");
  expect(config.description).toContain("AI provider");
  expect(config.description).toContain("track titles, artist names, ISRCs, and your brief");
  expect(config.description).toContain("up to 1,000 tracks per call");
  expect(config.description).toContain("without deducting Recoup credits");
  expect(config.description).toContain("Use nextPage");
  expect(config.description).toContain("does not establish licensing clearance");
  expect(Object.keys(config.inputSchema.shape)).toEqual(["catalog_id", "criteria", "start_page"]);
  expect(config.inputSchema.safeParse({ catalog_id: "catalog", criteria: "theme" }).success).toBe(
    true,
  );
  expect(config.inputSchema.safeParse({ catalog_id: "", criteria: "theme" }).success).toBe(false);
  expect(config.inputSchema.safeParse({ catalog_id: "catalog", criteria: "" }).success).toBe(false);
  if (oauth)
    expect(config.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    });
  expect(mocks.analyze).not.toHaveBeenCalled();
});

it("preserves the real registered callback arguments and result envelope", async () => {
  const registerTool = vi.fn();
  registerGetCatalogSongsTool({ registerTool } as unknown as McpServer);
  const response = { results: [{ isrc: "saved-isrc" }], totalSongs: 250, totalPages: 3 };
  mocks.catalogs.mockResolvedValueOnce([{ id: "catalog" }]);
  mocks.analyze.mockResolvedValue(response);
  const result = await registerTool.mock.calls[0][2](
    { catalog_id: "catalog", criteria: "theme", start_page: 11 },
    {},
  );
  expect(mocks.analyze).toHaveBeenCalledExactlyOnceWith({
    catalogId: "catalog",
    criteria: "theme",
    startPage: 11,
  });
  expect(result).toEqual({ content: [{ type: "text", text: JSON.stringify(response) }] });
});

it("denies an inaccessible catalog before sending a brief to the provider", async () => {
  const registerTool = vi.fn();
  registerGetCatalogSongsTool({ registerTool } as unknown as McpServer);
  mocks.catalogs.mockResolvedValueOnce([]);
  const result = await registerTool.mock.calls[0][2](
    { catalog_id: "foreign", criteria: "theme" },
    {},
  );
  expect(JSON.parse(result.content[0].text)).toEqual({
    success: false,
    message: "Catalog access denied.",
  });
  expect(mocks.analyze).not.toHaveBeenCalled();
});
