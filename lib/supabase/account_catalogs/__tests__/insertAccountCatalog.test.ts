import { describe, it, expect, vi, beforeEach } from "vitest";

import { insertAccountCatalog } from "../insertAccountCatalog";

const mockFrom = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("insertAccountCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("idempotently links an account to a catalog (upsert, ignore duplicates)", async () => {
    await insertAccountCatalog({ account: "acct-1", catalog: "cat-1" });

    expect(mockFrom).toHaveBeenCalledWith("account_catalogs");
    expect(mockUpsert).toHaveBeenCalledWith(
      { account: "acct-1", catalog: "cat-1" },
      { onConflict: "account,catalog", ignoreDuplicates: true },
    );
  });

  it("throws when the upsert fails", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "boom" } });

    await expect(insertAccountCatalog({ account: "acct-1", catalog: "cat-1" })).rejects.toThrow(
      /Failed to link account_catalogs/,
    );
  });
});
