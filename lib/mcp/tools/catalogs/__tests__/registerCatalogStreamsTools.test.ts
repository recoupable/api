import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCatalogStreamsTools } from "../registerCatalogStreamsTools";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getCatalogStreams } from "@/lib/catalog/getCatalogStreams";
import { manageCatalogStreamTracking } from "@/lib/catalog/manageCatalogStreamTracking";
vi.mock("@/lib/mcp/resolveAccountId", () => ({ resolveAccountId: vi.fn() }));
vi.mock("@/lib/catalog/getCatalogStreams", () => ({
  getCatalogStreams: vi.fn().mockResolvedValue({ data: { recordings: [] } }),
}));
vi.mock("@/lib/catalog/manageCatalogStreamTracking", () => ({
  manageCatalogStreamTracking: vi.fn().mockResolvedValue({ data: { tracking: null } }),
}));
const id = "00000000-0000-4000-8000-000000000001";
const handlers = new Map<string, (input: never, extra: never) => Promise<{ isError?: boolean }>>();
beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
  vi.mocked(resolveAccountId).mockResolvedValue({ accountId: "derived", error: undefined });
  registerCatalogStreamsTools({
    registerTool: (name: string, _config: unknown, handler: never) => handlers.set(name, handler),
  } as unknown as McpServer);
});
describe("daily stream MCP tools", () => {
  it("registers history and explicit tracking controls", () => {
    expect([...handlers.keys()]).toEqual(["get_catalog_streams", "manage_catalog_stream_tracking"]);
  });
  it.each(["get_catalog_streams", "manage_catalog_stream_tracking"])(
    "rejects delegated OAuth for %s",
    async name => {
      expect(
        await handlers.get(name)!({} as never, { authInfo: { extra: { oauth: {} } } } as never),
      ).toMatchObject({ isError: true });
      expect(resolveAccountId).not.toHaveBeenCalled();
      expect(getCatalogStreams).not.toHaveBeenCalled();
      expect(manageCatalogStreamTracking).not.toHaveBeenCalled();
    },
  );
  it("passes only the resolved actor to collection controls", async () => {
    await handlers.get("manage_catalog_stream_tracking")!(
      { catalog_id: id, action: "enable" } as never,
      { authInfo: {} } as never,
    );
    expect(manageCatalogStreamTracking).toHaveBeenCalledWith("derived", {
      catalog_id: id,
      action: "enable",
    });
  });
  it("scopes successful history reads to the resolved actor", async () => {
    const query = { catalog_id: id, since: "2026-09-02", days: 1, page: 1, limit: 25 };
    await handlers.get("get_catalog_streams")!(query as never, {} as never);
    expect(getCatalogStreams).toHaveBeenCalledWith("derived", query);
  });
  it("rejects unauthenticated read requests", async () => {
    vi.mocked(resolveAccountId).mockResolvedValue({ accountId: null, error: "Denied" });
    expect(await handlers.get("get_catalog_streams")!({} as never, {} as never)).toMatchObject({
      isError: true,
    });
    expect(getCatalogStreams).not.toHaveBeenCalled();
  });
});
