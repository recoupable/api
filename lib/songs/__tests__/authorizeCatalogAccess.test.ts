import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { authorizeCatalogAccess } from "@/lib/songs/authorizeCatalogAccess";
import { selectAccountCatalogs } from "@/lib/supabase/account_catalogs/selectAccountCatalogs";

vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalogs", () => ({
  selectAccountCatalogs: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/catalog/getCatalogOwnerIds", () => ({
  getCatalogOwnerIds: vi.fn(async (accountId: string) => [accountId]),
}));

describe("authorizeCatalogAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows a catalog the account owns", async () => {
    vi.mocked(selectAccountCatalogs).mockResolvedValue([{ id: "cat_1" }] as never);

    expect(await authorizeCatalogAccess("acc_1", ["cat_1"])).toBeNull();
  });

  it("rejects a catalog the account does not own", async () => {
    vi.mocked(selectAccountCatalogs).mockResolvedValue([{ id: "mine" }] as never);

    const result = await authorizeCatalogAccess("acc_1", ["someone_elses"]);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  // A write can name several catalogs in one body; authorizing only the first
  // would let one owned catalog carry edits into catalogs the caller does not own.
  it("rejects when only one of several catalogs is unowned", async () => {
    vi.mocked(selectAccountCatalogs).mockResolvedValue([{ id: "mine" }] as never);

    const result = await authorizeCatalogAccess("acc_1", ["mine", "theirs"]);

    expect((result as NextResponse).status).toBe(403);
  });

  // Review finding (cubic, 2026-07-30). A bulk body naming many catalogs used
  // to fan out into one query per catalog, which can exhaust the connection
  // pool before the write even runs.
  it("reads the caller's catalogs once regardless of how many are named", async () => {
    vi.mocked(selectAccountCatalogs).mockResolvedValue([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ] as never);

    await authorizeCatalogAccess("acc_1", ["a", "b", "c", "a", "b"]);

    expect(selectAccountCatalogs).toHaveBeenCalledTimes(1);
    expect(selectAccountCatalogs).toHaveBeenCalledWith(["acc_1"]);
  });

  // Review finding (cubic, 2026-07-30). selectAccountCatalogs throws on a query
  // failure, and that must surface as a 500 from the handler rather than being
  // swallowed into a false "does not belong" 403 that clients will not retry.
  it("propagates a database failure rather than reporting it as forbidden", async () => {
    vi.mocked(selectAccountCatalogs).mockRejectedValue(new Error("connection reset"));

    await expect(authorizeCatalogAccess("acc_1", ["cat_1"])).rejects.toThrow("connection reset");
  });
});
