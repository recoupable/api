import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { updateCatalogHandler } from "../updateCatalogHandler";
import { validateUpdateCatalogRequest } from "../validateUpdateCatalogRequest";
import { getCatalogOwnerIds } from "../getCatalogOwnerIds";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";
import { updateCatalog } from "@/lib/supabase/catalogs/updateCatalog";

vi.mock("../validateUpdateCatalogRequest", () => ({ validateUpdateCatalogRequest: vi.fn() }));
vi.mock("../getCatalogOwnerIds", () => ({ getCatalogOwnerIds: vi.fn() }));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalog", () => ({
  selectAccountCatalog: vi.fn(),
}));
vi.mock("@/lib/supabase/catalogs/updateCatalog", () => ({ updateCatalog: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const organizationId = "550e8400-e29b-41d4-a716-446655440111";
const catalogId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const renamed = {
  id: catalogId,
  name: "Bad Bunny",
  created_at: "2026-06-18T00:00:00Z",
  updated_at: "2026-08-06T00:00:00Z",
};

const link = {
  id: "cccccccc-dddd-4eee-8fff-000000000000",
  account: accountId,
  catalog: catalogId,
  created_at: "2026-06-18T00:00:00Z",
  updated_at: "2026-06-18T00:00:00Z",
};

const makeRequest = () =>
  new NextRequest(`http://localhost/api/catalogs/${catalogId}`, { method: "PATCH" });

const okValidation = () =>
  vi
    .mocked(validateUpdateCatalogRequest)
    .mockResolvedValue({ accountId, catalogId, name: "Bad Bunny" });

describe("updateCatalogHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("short-circuits with the validator error and never touches the database", async () => {
    const err = NextResponse.json({ status: "error" }, { status: 400 });
    vi.mocked(validateUpdateCatalogRequest).mockResolvedValue(err);

    const res = await updateCatalogHandler(makeRequest(), catalogId);

    expect(res).toBe(err);
    expect(getCatalogOwnerIds).not.toHaveBeenCalled();
    expect(updateCatalog).not.toHaveBeenCalled();
  });

  it("renames a catalog the caller owns", async () => {
    okValidation();
    vi.mocked(getCatalogOwnerIds).mockResolvedValue([accountId]);
    vi.mocked(selectAccountCatalog).mockResolvedValue(link);
    vi.mocked(updateCatalog).mockResolvedValue(renamed);

    const res = await updateCatalogHandler(makeRequest(), catalogId);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(updateCatalog).toHaveBeenCalledWith(catalogId, { name: "Bad Bunny" });
    expect(body).toEqual({ status: "success", catalog: renamed });
  });

  it("renames a catalog owned by one of the caller's organizations", async () => {
    okValidation();
    vi.mocked(getCatalogOwnerIds).mockResolvedValue([accountId, organizationId]);
    vi.mocked(selectAccountCatalog).mockResolvedValue({ ...link, account: organizationId });
    vi.mocked(updateCatalog).mockResolvedValue(renamed);

    const res = await updateCatalogHandler(makeRequest(), catalogId);

    expect(res.status).toBe(200);
    expect(selectAccountCatalog).toHaveBeenCalledWith({
      accountIds: [accountId, organizationId],
      catalogId,
    });
  });

  it("404s a catalog the caller cannot see, without renaming it", async () => {
    okValidation();
    vi.mocked(getCatalogOwnerIds).mockResolvedValue([accountId]);
    vi.mocked(selectAccountCatalog).mockResolvedValue(null);

    const res = await updateCatalogHandler(makeRequest(), catalogId);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", error: "Catalog not found" });
    expect(updateCatalog).not.toHaveBeenCalled();
  });

  it("404s when the catalog row disappears between the check and the update", async () => {
    okValidation();
    vi.mocked(getCatalogOwnerIds).mockResolvedValue([accountId]);
    vi.mocked(selectAccountCatalog).mockResolvedValue(link);
    vi.mocked(updateCatalog).mockResolvedValue(null);

    const res = await updateCatalogHandler(makeRequest(), catalogId);

    expect(res.status).toBe(404);
  });

  it("500s when the update throws", async () => {
    okValidation();
    vi.mocked(getCatalogOwnerIds).mockResolvedValue([accountId]);
    vi.mocked(selectAccountCatalog).mockResolvedValue(link);
    vi.mocked(updateCatalog).mockRejectedValue(new Error("boom"));

    const res = await updateCatalogHandler(makeRequest(), catalogId);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
