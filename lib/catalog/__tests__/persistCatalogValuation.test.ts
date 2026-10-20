import { beforeEach, expect, it, vi } from "vitest";
import { persistCatalogValuation } from "../persistCatalogValuation";
import { insertCatalogValuation } from "@/lib/supabase/catalog_valuations/insertCatalogValuation";
vi.mock("@/lib/supabase/catalog_valuations/insertCatalogValuation", () => ({
  insertCatalogValuation: vi.fn(),
}));
const input = {
  catalogId: "740d5050-40ec-4892-a040-b78bb50fef2f",
  valuation: { low: 1, mid: 2, high: 3 },
  measuredSongCount: 12,
  totalStreams: 123,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
it("confirms one persisted run without read-time deduplication", async () => {
  vi.mocked(insertCatalogValuation).mockResolvedValue({ id: "history_fixture" } as never);
  expect(await persistCatalogValuation(input)).toBe(true);
  expect(insertCatalogValuation).toHaveBeenCalledExactlyOnceWith({
    catalog_id: input.catalogId,
    low: 1,
    mid: 2,
    high: 3,
    measured_song_count: 12,
    total_streams: 123,
  });
});
it.each([null, new Error("database unavailable")])(
  "does not fail the paid result or claim confirmation on save failure: %j",
  async failure => {
    if (failure instanceof Error) vi.mocked(insertCatalogValuation).mockRejectedValue(failure);
    else vi.mocked(insertCatalogValuation).mockResolvedValue(failure);
    expect(await persistCatalogValuation(input)).toBe(false);
  },
);
it.each([
  { measuredSongCount: 0 },
  { totalStreams: -1 },
  { valuation: { low: NaN, mid: 2, high: 3 } },
  { valuation: { low: 3, mid: 2, high: 1 } },
])("does not write unmeasured or invalid estimates: %j", async changes => {
  expect(await persistCatalogValuation({ ...input, ...changes })).toBe(false);
  expect(insertCatalogValuation).not.toHaveBeenCalled();
});
