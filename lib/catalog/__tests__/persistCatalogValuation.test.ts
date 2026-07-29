import { describe, it, expect, vi, beforeEach } from "vitest";
import { persistCatalogValuation } from "../persistCatalogValuation";
import { insertCatalogValuation } from "@/lib/supabase/catalog_valuations/insertCatalogValuation";
import { selectCatalogValuations } from "@/lib/supabase/catalog_valuations/selectCatalogValuations";

vi.mock("@/lib/supabase/catalog_valuations/insertCatalogValuation", () => ({
  insertCatalogValuation: vi.fn(),
}));
vi.mock("@/lib/supabase/catalog_valuations/selectCatalogValuations", () => ({
  selectCatalogValuations: vi.fn(),
}));

const catalogId = "740d5050-40ec-4892-a040-b78bb50fef2f";
const input = {
  catalogId,
  valuation: { low: 1000, mid: 2000, high: 3000 },
  measuredSongCount: 12,
  totalStreams: 456789,
};

describe("persistCatalogValuation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("inserts a snake_case row from the camelCase inputs", async () => {
    vi.mocked(insertCatalogValuation).mockResolvedValue({ id: "v1" } as never);

    await persistCatalogValuation(input);

    expect(insertCatalogValuation).toHaveBeenCalledWith({
      catalog_id: catalogId,
      low: 1000,
      mid: 2000,
      high: 3000,
      measured_song_count: 12,
      total_streams: 456789,
    });
    expect(selectCatalogValuations).not.toHaveBeenCalled();
  });

  it("never throws when the insert fails (best-effort)", async () => {
    vi.mocked(insertCatalogValuation).mockRejectedValue(new Error("down"));

    await expect(persistCatalogValuation(input)).resolves.toBeUndefined();
  });

  describe("dedupeDaily", () => {
    it("skips the insert when a row already exists for today (UTC)", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-29T18:00:00Z"));
      vi.mocked(selectCatalogValuations).mockResolvedValue([
        { measured_at: "2026-07-29T02:00:00Z" } as never,
      ]);

      await persistCatalogValuation({ ...input, dedupeDaily: true });

      expect(selectCatalogValuations).toHaveBeenCalledWith({ catalogId, limit: 1 });
      expect(insertCatalogValuation).not.toHaveBeenCalled();
    });

    it("inserts when the newest row is from an earlier day", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-29T18:00:00Z"));
      vi.mocked(selectCatalogValuations).mockResolvedValue([
        { measured_at: "2026-07-28T23:59:00Z" } as never,
      ]);
      vi.mocked(insertCatalogValuation).mockResolvedValue({ id: "v2" } as never);

      await persistCatalogValuation({ ...input, dedupeDaily: true });

      expect(insertCatalogValuation).toHaveBeenCalledTimes(1);
    });

    it("inserts when the catalog has no valuations yet", async () => {
      vi.mocked(selectCatalogValuations).mockResolvedValue([]);
      vi.mocked(insertCatalogValuation).mockResolvedValue({ id: "v1" } as never);

      await persistCatalogValuation({ ...input, dedupeDaily: true });

      expect(insertCatalogValuation).toHaveBeenCalledTimes(1);
    });

    it("still inserts when the dedupe lookup errors (null)", async () => {
      vi.mocked(selectCatalogValuations).mockResolvedValue(null);
      vi.mocked(insertCatalogValuation).mockResolvedValue({ id: "v1" } as never);

      await persistCatalogValuation({ ...input, dedupeDaily: true });

      expect(insertCatalogValuation).toHaveBeenCalledTimes(1);
    });
  });
});
