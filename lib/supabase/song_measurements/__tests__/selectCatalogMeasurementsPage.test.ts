import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectCatalogMeasurementsPage } from "../selectCatalogMeasurementsPage";
import supabase from "../../serverClient";

vi.mock("../../serverClient", () => ({
  default: { rpc: vi.fn() },
}));

const catalogId = "7d3e5c35-1fac-4b88-aa90-e2e4a52dfe78";
const artistAccountId = "b1814076-8e19-4a77-9dea-2ec150e26aaa";

const row = {
  isrc: "USUYG1075006",
  title: "Suavemente",
  playcount: 717012221,
  measured_at: "2026-07-06T00:00:00+00:00",
};

describe("selectCatalogMeasurementsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads one page with limit/offset derived from page/limit", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [row], error: null } as never);

    const result = await selectCatalogMeasurementsPage({ catalogId, page: 3, limit: 50 });

    expect(supabase.rpc).toHaveBeenCalledWith("get_catalog_measurements_page", {
      p_catalog: catalogId,
      p_limit: 50,
      p_offset: 100,
    });
    expect(result).toEqual([row]);
  });

  it("passes the artist filter through when scoped", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [row], error: null } as never);

    await selectCatalogMeasurementsPage({ catalogId, artistAccountId, page: 1, limit: 20 });

    expect(supabase.rpc).toHaveBeenCalledWith("get_catalog_measurements_page", {
      p_catalog: catalogId,
      p_artist: artistAccountId,
      p_limit: 20,
      p_offset: 0,
    });
  });

  it("returns [] when the page is past the end", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

    expect(await selectCatalogMeasurementsPage({ catalogId, page: 99, limit: 50 })).toEqual([]);
  });

  it("returns null on error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: "boom" },
    } as never);

    expect(await selectCatalogMeasurementsPage({ catalogId, page: 1, limit: 50 })).toBeNull();
    consoleError.mockRestore();
  });
});
