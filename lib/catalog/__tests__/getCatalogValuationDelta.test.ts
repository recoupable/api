import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCatalogValuationDelta } from "../getCatalogValuationDelta";
import { selectCatalogValuations } from "@/lib/supabase/catalog_valuations/selectCatalogValuations";
import { selectCatalogMeasurementsAggregate } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate";
import { getCatalogEarliestReleaseDate } from "../getCatalogEarliestReleaseDate";

vi.mock("@/lib/supabase/catalog_valuations/selectCatalogValuations", () => ({
  selectCatalogValuations: vi.fn(),
}));
vi.mock("@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate", () => ({
  selectCatalogMeasurementsAggregate: vi.fn(),
}));
vi.mock("../getCatalogEarliestReleaseDate", () => ({ getCatalogEarliestReleaseDate: vi.fn() }));

const catalogId = "740d5050-40ec-4892-a040-b78bb50fef2f";
const row = (mid: number, measured_at: string) => ({
  low: mid * 0.8,
  mid,
  high: mid * 1.2,
  measured_at,
});

describe("getCatalogValuationDelta", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns current + previous from the two most recent history rows", async () => {
    vi.mocked(selectCatalogValuations).mockResolvedValue([
      row(1_100_000, "2026-07-29T00:00:00Z"),
      row(1_000_000, "2026-07-22T00:00:00Z"),
    ] as never);

    const delta = await getCatalogValuationDelta({ catalogId });

    expect(selectCatalogValuations).toHaveBeenCalledWith({ catalogId, limit: 2 });
    expect(delta).toMatchObject({
      current: { mid: 1_100_000, measured_at: "2026-07-29T00:00:00Z" },
      previous: { mid: 1_000_000 },
    });
    expect(selectCatalogMeasurementsAggregate).not.toHaveBeenCalled();
  });

  it("returns a baseline (previous null) when only one history row exists", async () => {
    vi.mocked(selectCatalogValuations).mockResolvedValue([
      row(1_100_000, "2026-07-29T00:00:00Z"),
    ] as never);

    const delta = await getCatalogValuationDelta({ catalogId });

    expect(delta?.previous).toBeNull();
    expect(delta?.current.mid).toBe(1_100_000);
  });

  it("falls back to the read-time band when the history is empty but songs are measured", async () => {
    vi.mocked(selectCatalogValuations).mockResolvedValue([]);
    vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
      measuredSongCount: 10,
      totalStreams: 1_000_000,
    });
    vi.mocked(getCatalogEarliestReleaseDate).mockResolvedValue("2016-07-01");

    const delta = await getCatalogValuationDelta({ catalogId });

    expect(delta).not.toBeNull();
    expect(delta?.previous).toBeNull();
    expect(delta?.current.mid).toBeGreaterThan(0);
  });

  it("returns null when the catalog has no measured songs at all", async () => {
    vi.mocked(selectCatalogValuations).mockResolvedValue([]);
    vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
      measuredSongCount: 0,
      totalStreams: 0,
    });

    const delta = await getCatalogValuationDelta({ catalogId });

    expect(delta).toBeNull();
  });

  it("returns null and never throws when the history read errors", async () => {
    vi.mocked(selectCatalogValuations).mockRejectedValue(new Error("down"));

    await expect(getCatalogValuationDelta({ catalogId })).resolves.toBeNull();
  });
});
