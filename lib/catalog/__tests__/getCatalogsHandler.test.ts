import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getCatalogsHandler } from "../getCatalogsHandler";
import { validateGetCatalogsRequest } from "../validateGetCatalogsRequest";
import { getCatalogOwnerIds } from "../getCatalogOwnerIds";
import { getCatalogValuations } from "../getCatalogValuations";
import { resolveCatalogOwners } from "../resolveCatalogOwners";
import { selectAccountCatalogs } from "@/lib/supabase/account_catalogs/selectAccountCatalogs";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetCatalogsRequest", () => ({
  validateGetCatalogsRequest: vi.fn(),
}));

vi.mock("../getCatalogOwnerIds", () => ({ getCatalogOwnerIds: vi.fn() }));
vi.mock("../getCatalogValuations", () => ({ getCatalogValuations: vi.fn() }));
vi.mock("../resolveCatalogOwners", () => ({ resolveCatalogOwners: vi.fn() }));

vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalogs", () => ({
  selectAccountCatalogs: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const organizationId = "550e8400-e29b-41d4-a716-446655440111";
const makeRequest = () =>
  new NextRequest(`http://localhost/api/accounts/${accountId}/catalogs`, { method: "GET" });

const catalog = {
  id: "c1",
  name: "Catalog A",
  created_at: "2024-01-01",
  updated_at: "2024-01-02",
  owners: [accountId],
};

const band = { low: 10, mid: 20, high: 30 };
const owner = {
  id: accountId,
  name: "Sweetman.eth",
  image: "https://img/person.png",
  is_organization: false,
};

const okAuth = () => vi.mocked(validateGetCatalogsRequest).mockResolvedValue({ accountId });

describe("getCatalogsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCatalogOwnerIds).mockResolvedValue([accountId]);
    vi.mocked(getCatalogValuations).mockResolvedValue(new Map());
    vi.mocked(resolveCatalogOwners).mockResolvedValue(new Map());
  });

  it("returns the validator error when validation fails", async () => {
    const err = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateGetCatalogsRequest).mockResolvedValue(err);

    const res = await getCatalogsHandler(makeRequest(), Promise.resolve({ id: accountId }));

    expect(res).toBe(err);
    expect(selectAccountCatalogs).not.toHaveBeenCalled();
  });

  it("returns each catalog with its valuation and owner", async () => {
    okAuth();
    vi.mocked(selectAccountCatalogs).mockResolvedValue([catalog]);
    vi.mocked(getCatalogValuations).mockResolvedValue(
      new Map([["c1", { measuredSongCount: 26, valuation: band }]]),
    );
    vi.mocked(resolveCatalogOwners).mockResolvedValue(new Map([["c1", owner]]));

    const res = await getCatalogsHandler(makeRequest(), Promise.resolve({ id: accountId }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(selectAccountCatalogs).toHaveBeenCalledWith([accountId]);
    // `owners` is the selector's internal ownership list — the response must
    // carry the documented fields only.
    expect(body).toEqual({
      status: "success",
      catalogs: [
        {
          id: catalog.id,
          name: catalog.name,
          created_at: catalog.created_at,
          updated_at: catalog.updated_at,
          measured_song_count: 26,
          valuation: band,
          owner,
        },
      ],
    });
    expect(body.catalogs[0]).not.toHaveProperty("owners");
  });

  it("reports a null valuation for a catalog with nothing measured", async () => {
    okAuth();
    vi.mocked(selectAccountCatalogs).mockResolvedValue([catalog]);
    vi.mocked(getCatalogValuations).mockResolvedValue(
      new Map([["c1", { measuredSongCount: 0, valuation: null }]]),
    );
    vi.mocked(resolveCatalogOwners).mockResolvedValue(new Map([["c1", owner]]));

    const body = await (
      await getCatalogsHandler(makeRequest(), Promise.resolve({ id: accountId }))
    ).json();

    expect(body.catalogs[0].valuation).toBeNull();
    expect(body.catalogs[0].measured_song_count).toBe(0);
  });

  it("passes only the caller's organizations as organization ids", async () => {
    okAuth();
    vi.mocked(getCatalogOwnerIds).mockResolvedValue([accountId, organizationId]);
    vi.mocked(selectAccountCatalogs).mockResolvedValue([catalog]);

    await getCatalogsHandler(makeRequest(), Promise.resolve({ id: accountId }));

    expect(resolveCatalogOwners).toHaveBeenCalledWith({
      catalogIds: ["c1"],
      ownerIds: [accountId, organizationId],
      organizationIds: [organizationId],
    });
  });

  it("does not value or resolve owners when the account has no catalogs", async () => {
    okAuth();
    vi.mocked(selectAccountCatalogs).mockResolvedValue([]);

    const body = await (
      await getCatalogsHandler(makeRequest(), Promise.resolve({ id: accountId }))
    ).json();

    expect(body).toEqual({ status: "success", catalogs: [] });
    expect(getCatalogValuations).toHaveBeenCalledWith([]);
    expect(resolveCatalogOwners).toHaveBeenCalledWith({
      catalogIds: [],
      ownerIds: [accountId],
      organizationIds: [],
    });
  });

  it("returns 500 with a generic error, not the raw exception message", async () => {
    okAuth();
    vi.mocked(selectAccountCatalogs).mockRejectedValue(
      new Error("db down: connection refused at 10.0.0.1:5432"),
    );

    const res = await getCatalogsHandler(makeRequest(), Promise.resolve({ id: accountId }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ status: "error", error: "Internal server error" });
    expect(body.error).not.toContain("db down");
    expect(body.error).not.toContain("10.0.0.1");
  });
});
