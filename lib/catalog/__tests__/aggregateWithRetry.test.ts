import { describe, it, expect, vi, beforeEach } from "vitest";

import { aggregateWithRetry } from "../aggregateWithRetry";
import { selectCatalogMeasurementsAggregate } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate";

vi.mock("@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate", () => ({
  selectCatalogMeasurementsAggregate: vi.fn(),
}));

const catalogId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("aggregateWithRetry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the first successful aggregate without retrying", async () => {
    vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
      measuredSongCount: 26,
      totalStreams: 7676,
    });

    const result = await aggregateWithRetry(catalogId);

    expect(result).toEqual({ measuredSongCount: 26, totalStreams: 7676 });
    expect(selectCatalogMeasurementsAggregate).toHaveBeenCalledTimes(1);
  });

  it("retries once before giving up on a catalog", async () => {
    vi.mocked(selectCatalogMeasurementsAggregate)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ measuredSongCount: 26, totalStreams: 7676 });

    const result = await aggregateWithRetry(catalogId);

    // A transient RPC failure must not become "not measured" — caught live on a
    // 9,939-song catalog that reported null once and $88.9M on the next run.
    expect(selectCatalogMeasurementsAggregate).toHaveBeenCalledTimes(2);
    expect(result?.measuredSongCount).toBe(26);
  });

  it("returns null and logs when both attempts fail", async () => {
    vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue(null);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await aggregateWithRetry(catalogId);

    expect(result).toBeNull();
    expect(selectCatalogMeasurementsAggregate).toHaveBeenCalledTimes(2);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining(catalogId));
    logged.mockRestore();
  });
});
