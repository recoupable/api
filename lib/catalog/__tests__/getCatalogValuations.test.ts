import { describe, it, expect, vi, beforeEach } from "vitest";

import { getCatalogValuations } from "../getCatalogValuations";
import { aggregateWithRetry } from "../aggregateWithRetry";
import { getEarliestReleaseDates } from "../getEarliestReleaseDates";
import { computeValuationBand } from "../computeValuationBand";

vi.mock("../aggregateWithRetry", () => ({ aggregateWithRetry: vi.fn() }));
vi.mock("../getEarliestReleaseDates", () => ({ getEarliestReleaseDates: vi.fn() }));

const catalogA = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const catalogB = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";

describe("getCatalogValuations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEarliestReleaseDates).mockResolvedValue(new Map());
  });

  it("returns an empty map without querying for no catalogs", async () => {
    const result = await getCatalogValuations([]);

    expect(result.size).toBe(0);
    expect(aggregateWithRetry).not.toHaveBeenCalled();
    expect(getEarliestReleaseDates).not.toHaveBeenCalled();
  });

  it("values a measured catalog with the same model as the report", async () => {
    vi.mocked(aggregateWithRetry).mockResolvedValue({ measuredSongCount: 26, totalStreams: 7676 });
    vi.mocked(getEarliestReleaseDates).mockResolvedValue(new Map([[catalogA, "2020-01-01"]]));

    const result = await getCatalogValuations([catalogA]);
    const expected = computeValuationBand({
      totalStreams: 7676,
      earliestReleaseDate: "2020-01-01",
    }).valuation;

    expect(result.get(catalogA)).toEqual({ measuredSongCount: 26, valuation: expected });
  });

  it("reports a null valuation for a catalog with nothing measured", async () => {
    vi.mocked(aggregateWithRetry).mockResolvedValue({ measuredSongCount: 0, totalStreams: 0 });

    const result = await getCatalogValuations([catalogA]);

    expect(result.get(catalogA)).toEqual({ measuredSongCount: 0, valuation: null });
  });

  it("uses each catalog's own age, so equal streams can be worth different amounts", async () => {
    vi.mocked(aggregateWithRetry).mockResolvedValue({ measuredSongCount: 5, totalStreams: 1000 });
    vi.mocked(getEarliestReleaseDates).mockResolvedValue(
      new Map([
        [catalogA, "2015-01-01"],
        [catalogB, "2024-01-01"],
      ]),
    );

    const result = await getCatalogValuations([catalogA, catalogB]);

    const older = result.get(catalogA)?.valuation;
    const newer = result.get(catalogB)?.valuation;
    expect(older).toEqual(
      computeValuationBand({ totalStreams: 1000, earliestReleaseDate: "2015-01-01" }).valuation,
    );
    expect(newer).toEqual(
      computeValuationBand({ totalStreams: 1000, earliestReleaseDate: "2024-01-01" }).valuation,
    );
    expect(older?.mid).not.toEqual(newer?.mid);
  });

  it("falls back to the default age when no release date resolved", async () => {
    vi.mocked(aggregateWithRetry).mockResolvedValue({ measuredSongCount: 5, totalStreams: 1000 });
    vi.mocked(getEarliestReleaseDates).mockResolvedValue(new Map());

    const result = await getCatalogValuations([catalogA]);

    expect(result.get(catalogA)?.valuation).toEqual(
      computeValuationBand({ totalStreams: 1000, earliestReleaseDate: null }).valuation,
    );
  });

  it("treats a catalog whose aggregate failed twice as unmeasured rather than throwing", async () => {
    vi.mocked(aggregateWithRetry).mockResolvedValue(null);

    const result = await getCatalogValuations([catalogA]);

    expect(result.get(catalogA)).toEqual({ measuredSongCount: 0, valuation: null });
  });
});
