import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectCatalogValuations } from "@/lib/supabase/catalog_valuations/selectCatalogValuations";

const selectChain = vi.fn();
const eqChain = vi.fn();
const orderChain = vi.fn();
const limitChain = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(() => ({ select: selectChain })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  selectChain.mockReturnValue({ eq: eqChain });
  eqChain.mockReturnValue({ order: orderChain });
  orderChain.mockReturnValue({ limit: limitChain });
});

const catalogId = "740d5050-40ec-4892-a040-b78bb50fef2f";

describe("selectCatalogValuations", () => {
  it("returns the catalog's valuations latest-first with the requested limit", async () => {
    const rows = [
      { id: "v2", catalog_id: catalogId, measured_at: "2026-07-29T00:00:00Z" },
      { id: "v1", catalog_id: catalogId, measured_at: "2026-07-28T00:00:00Z" },
    ];
    limitChain.mockResolvedValue({ data: rows, error: null });

    const result = await selectCatalogValuations({ catalogId, limit: 30 });

    expect(result).toEqual(rows);
    expect(eqChain).toHaveBeenCalledWith("catalog_id", catalogId);
    expect(orderChain).toHaveBeenCalledWith("measured_at", { ascending: false });
    expect(limitChain).toHaveBeenCalledWith(30);
  });

  it("returns null when supabase reports an error", async () => {
    limitChain.mockResolvedValue({ data: null, error: { message: "down" } });

    const result = await selectCatalogValuations({ catalogId, limit: 1 });

    expect(result).toBeNull();
  });

  it("returns an empty array when the catalog has no valuations yet", async () => {
    limitChain.mockResolvedValue({ data: [], error: null });

    const result = await selectCatalogValuations({ catalogId, limit: 30 });

    expect(result).toEqual([]);
  });
});
