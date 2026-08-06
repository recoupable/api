import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { deleteCatalogHandler } from "../deleteCatalogHandler";
import { validateDeleteCatalogRequest } from "../validateDeleteCatalogRequest";
import { getCatalogOwnerIds } from "../getCatalogOwnerIds";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";
import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import { deleteCatalogById } from "@/lib/supabase/catalogs/deleteCatalogById";

vi.mock("../validateDeleteCatalogRequest", () => ({ validateDeleteCatalogRequest: vi.fn() }));
vi.mock("../getCatalogOwnerIds", () => ({ getCatalogOwnerIds: vi.fn() }));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalog", () => ({
  selectAccountCatalog: vi.fn(),
}));
vi.mock("@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots", () => ({
  selectPlaycountSnapshots: vi.fn(),
}));
vi.mock("@/lib/supabase/catalogs/deleteCatalogById", () => ({ deleteCatalogById: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const organizationId = "550e8400-e29b-41d4-a716-446655440111";
const catalogId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const snapshotId = "11111111-2222-4333-8444-555555555555";

const snapshot = {
  id: snapshotId,
  account: accountId,
  album_count: 1,
  album_ids: ["album-1"],
  catalog: catalogId,
  created_at: "2026-08-06T00:00:00Z",
  estimated_cost_usd: 0,
  isrcs: null,
  platforms: ["spotify"],
  schedule: "once",
  state: "done",
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
  new NextRequest(`http://localhost/api/catalogs/${catalogId}`, { method: "DELETE" });

const okValidation = () =>
  vi.mocked(validateDeleteCatalogRequest).mockResolvedValue({ accountId, catalogId });

describe("deleteCatalogHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("short-circuits with the validator error and never deletes", async () => {
    const err = NextResponse.json({ status: "error" }, { status: 400 });
    vi.mocked(validateDeleteCatalogRequest).mockResolvedValue(err);

    const res = await deleteCatalogHandler(makeRequest(), catalogId);

    expect(res).toBe(err);
    expect(deleteCatalogById).not.toHaveBeenCalled();
  });

  it("404s a catalog the caller cannot see, without deleting it", async () => {
    okValidation();
    vi.mocked(getCatalogOwnerIds).mockResolvedValue([accountId]);
    vi.mocked(selectAccountCatalog).mockResolvedValue(null);

    const res = await deleteCatalogHandler(makeRequest(), catalogId);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", error: "Catalog not found" });
    expect(deleteCatalogById).not.toHaveBeenCalled();
  });

  it("deletes the catalog and reports the snapshots it released", async () => {
    okValidation();
    vi.mocked(getCatalogOwnerIds).mockResolvedValue([accountId]);
    vi.mocked(selectAccountCatalog).mockResolvedValue(link);
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([snapshot]);
    vi.mocked(deleteCatalogById).mockResolvedValue(catalogId);

    const res = await deleteCatalogHandler(makeRequest(), catalogId);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "success",
      catalog_id: catalogId,
      released_snapshot_ids: [snapshotId],
    });
    expect(selectPlaycountSnapshots).toHaveBeenCalledWith({ catalog: catalogId });
    expect(deleteCatalogById).toHaveBeenCalledWith(catalogId);
  });

  it("reads the snapshot ids before the delete clears their reference", async () => {
    okValidation();
    vi.mocked(getCatalogOwnerIds).mockResolvedValue([accountId]);
    vi.mocked(selectAccountCatalog).mockResolvedValue(link);
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([snapshot]);
    vi.mocked(deleteCatalogById).mockResolvedValue(catalogId);

    await deleteCatalogHandler(makeRequest(), catalogId);

    expect(vi.mocked(selectPlaycountSnapshots).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deleteCatalogById).mock.invocationCallOrder[0],
    );
  });

  it("deletes a catalog owned by one of the caller's organizations", async () => {
    okValidation();
    vi.mocked(getCatalogOwnerIds).mockResolvedValue([accountId, organizationId]);
    vi.mocked(selectAccountCatalog).mockResolvedValue({ ...link, account: organizationId });
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([]);
    vi.mocked(deleteCatalogById).mockResolvedValue(catalogId);

    const res = await deleteCatalogHandler(makeRequest(), catalogId);

    expect(res.status).toBe(200);
    expect(selectAccountCatalog).toHaveBeenCalledWith({
      accountIds: [accountId, organizationId],
      catalogId,
    });
  });

  it("404s when the catalog row is already gone at delete time", async () => {
    okValidation();
    vi.mocked(getCatalogOwnerIds).mockResolvedValue([accountId]);
    vi.mocked(selectAccountCatalog).mockResolvedValue(link);
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([]);
    vi.mocked(deleteCatalogById).mockResolvedValue(null);

    const res = await deleteCatalogHandler(makeRequest(), catalogId);

    expect(res.status).toBe(404);
  });

  it("500s when the delete throws", async () => {
    okValidation();
    vi.mocked(getCatalogOwnerIds).mockResolvedValue([accountId]);
    vi.mocked(selectAccountCatalog).mockResolvedValue(link);
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([]);
    vi.mocked(deleteCatalogById).mockRejectedValue(new Error("boom"));

    const res = await deleteCatalogHandler(makeRequest(), catalogId);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
