import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectCatalogMeasurementsAggregate } from "../selectCatalogMeasurementsAggregate";
import supabase from "../../serverClient";

vi.mock("../../serverClient", () => ({
  default: { rpc: vi.fn() },
}));

const catalogId = "7d3e5c35-1fac-4b88-aa90-e2e4a52dfe78";
const artistAccountId = "b1814076-8e19-4a77-9dea-2ec150e26aaa";

describe("selectCatalogMeasurementsAggregate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the whole-scope aggregate for a catalog", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ measured_song_count: 2679, total_streams: 16308837441 }],
      error: null,
    } as never);

    const result = await selectCatalogMeasurementsAggregate({ catalogId });

    expect(supabase.rpc).toHaveBeenCalledWith("get_catalog_measurements_aggregate", {
      p_catalog: catalogId,
    });
    expect(result).toEqual({ measuredSongCount: 2679, totalStreams: 16308837441 });
  });

  it("passes the artist filter through when scoped", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ measured_song_count: 322, total_streams: 1799402184 }],
      error: null,
    } as never);

    const result = await selectCatalogMeasurementsAggregate({ catalogId, artistAccountId });

    expect(supabase.rpc).toHaveBeenCalledWith("get_catalog_measurements_aggregate", {
      p_catalog: catalogId,
      p_artist: artistAccountId,
    });
    expect(result).toEqual({ measuredSongCount: 322, totalStreams: 1799402184 });
  });

  it("coerces numeric strings from PostgREST", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ measured_song_count: 40, total_streams: "21325663" }],
      error: null,
    } as never);

    const result = await selectCatalogMeasurementsAggregate({ catalogId });

    expect(result).toEqual({ measuredSongCount: 40, totalStreams: 21325663 });
  });

  it("returns a zero aggregate when the rpc yields no row", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

    expect(await selectCatalogMeasurementsAggregate({ catalogId })).toEqual({
      measuredSongCount: 0,
      totalStreams: 0,
    });
  });

  it("returns null on error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: "boom" },
    } as never);

    expect(await selectCatalogMeasurementsAggregate({ catalogId })).toBeNull();
    consoleError.mockRestore();
  });
});
