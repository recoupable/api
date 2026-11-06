import { describe, it, expect, vi, beforeEach } from "vitest";
import { insertCatalogValuation } from "@/lib/supabase/catalog_valuations/insertCatalogValuation";

const insertChain = vi.fn();
const selectChain = vi.fn();
const singleChain = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(() => ({ insert: insertChain })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  insertChain.mockReturnValue({ select: selectChain });
  selectChain.mockReturnValue({ single: singleChain });
});

const row = {
  catalog_id: "740d5050-40ec-4892-a040-b78bb50fef2f",
  low: 1000,
  mid: 2000,
  high: 3000,
  measured_song_count: 12,
  total_streams: 456789,
};

describe("insertCatalogValuation", () => {
  it("inserts the valuation row and returns it", async () => {
    const inserted = { id: "val-1", ...row, measured_at: "2026-07-29T00:00:00Z" };
    singleChain.mockResolvedValue({ data: inserted, error: null });

    const result = await insertCatalogValuation(row);

    expect(result).toEqual(inserted);
    expect(insertChain).toHaveBeenCalledWith(row);
  });

  it("returns null when supabase reports an error", async () => {
    singleChain.mockResolvedValue({ data: null, error: { message: "down" } });

    const result = await insertCatalogValuation(row);

    expect(result).toBeNull();
  });
});
