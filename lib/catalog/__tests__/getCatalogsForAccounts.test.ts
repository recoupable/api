import { describe, it, expect, vi, beforeEach } from "vitest";

import { getCatalogsForAccounts } from "../getCatalogsForAccounts";
import { selectAccountCatalogs } from "@/lib/supabase/account_catalogs/selectAccountCatalogs";

vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalogs", () => ({
  selectAccountCatalogs: vi.fn(),
}));

describe("getCatalogsForAccounts", () => {
  const accountId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => vi.clearAllMocks());

  it("flattens the nested catalogs relation to the wire shape", async () => {
    vi.mocked(selectAccountCatalogs).mockResolvedValue([
      {
        catalog: "c1",
        catalogs: [
          {
            id: "c1",
            name: "Catalog A",
            created_at: "2024-01-01",
            updated_at: "2024-01-02",
          },
        ],
      },
    ] as never);

    const result = await getCatalogsForAccounts([accountId]);

    expect(selectAccountCatalogs).toHaveBeenCalledWith({ accountIds: [accountId] });
    expect(result).toEqual({
      status: "success",
      catalogs: [
        { id: "c1", name: "Catalog A", created_at: "2024-01-01", updated_at: "2024-01-02" },
      ],
    });
  });

  it("returns an empty catalogs array when no rows match", async () => {
    vi.mocked(selectAccountCatalogs).mockResolvedValue([]);

    const result = await getCatalogsForAccounts([accountId]);

    expect(result).toEqual({ status: "success", catalogs: [] });
  });

  it("handles a 1:1 relation returned as a single object", async () => {
    vi.mocked(selectAccountCatalogs).mockResolvedValue([
      {
        catalog: "c2",
        catalogs: {
          id: "c2",
          name: "Catalog B",
          created_at: "2024-02-01",
          updated_at: "2024-02-02",
        },
      },
    ] as never);

    const result = await getCatalogsForAccounts([accountId]);

    expect(result.catalogs).toEqual([
      { id: "c2", name: "Catalog B", created_at: "2024-02-01", updated_at: "2024-02-02" },
    ]);
  });
});
