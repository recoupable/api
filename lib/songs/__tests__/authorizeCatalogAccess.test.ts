import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { authorizeCatalogAccess } from "@/lib/songs/authorizeCatalogAccess";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalog", () => ({
  selectAccountCatalog: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

const request = () => new NextRequest("https://api.test/api/catalogs/songs");

describe("authorizeCatalogAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // chat#1912 row 6. GET/POST/DELETE /api/catalogs/songs enforced no auth at
  // all: on prod, all three reached body or query validation with no
  // credentials, so anyone holding a catalog id could read, add or remove its
  // songs while /measurements returned 401 for the same catalog.
  it("rejects a caller with no credentials", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }) as never,
    );

    const result = await authorizeCatalogAccess(request(), ["cat_1"]);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    expect(selectAccountCatalog).not.toHaveBeenCalled();
  });

  it("rejects a catalog the caller does not own", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);
    vi.mocked(selectAccountCatalog).mockResolvedValue(null);

    const result = await authorizeCatalogAccess(request(), ["someone_elses"]);

    expect((result as NextResponse).status).toBe(403);
  });

  it("returns the account id for a catalog the caller owns", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);
    vi.mocked(selectAccountCatalog).mockResolvedValue({
      account: "acc_1",
      catalog: "cat_1",
    } as never);

    const result = await authorizeCatalogAccess(request(), ["cat_1"]);

    expect(result).toEqual({ accountId: "acc_1" });
  });

  it("rejects when only one of several catalogs is unowned", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);
    vi.mocked(selectAccountCatalog)
      .mockResolvedValueOnce({ account: "acc_1" } as never)
      .mockResolvedValueOnce(null);

    const result = await authorizeCatalogAccess(request(), ["mine", "theirs"]);

    expect((result as NextResponse).status).toBe(403);
  });

  it("checks ownership against the authenticated account, never a caller-supplied one", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_real" } as never);
    vi.mocked(selectAccountCatalog).mockResolvedValue({ account: "acc_real" } as never);

    await authorizeCatalogAccess(request(), ["cat_1"]);

    expect(selectAccountCatalog).toHaveBeenCalledWith({
      accountId: "acc_real",
      catalogId: "cat_1",
    });
  });
});
