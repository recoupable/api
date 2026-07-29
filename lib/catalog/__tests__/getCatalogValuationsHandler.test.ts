import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getCatalogValuationsHandler } from "../getCatalogValuationsHandler";
import { validateGetCatalogValuationsQuery } from "../validateGetCatalogValuationsQuery";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";
import { selectCatalogValuations } from "@/lib/supabase/catalog_valuations/selectCatalogValuations";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("../validateGetCatalogValuationsQuery", () => ({
  validateGetCatalogValuationsQuery: vi.fn(),
}));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalog", () => ({
  selectAccountCatalog: vi.fn(),
}));
vi.mock("@/lib/supabase/catalog_valuations/selectCatalogValuations", () => ({
  selectCatalogValuations: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const catalogId = "740d5050-40ec-4892-a040-b78bb50fef2f";

const makeRequest = () => new NextRequest(`http://localhost/api/catalogs/${catalogId}/valuations`);

const okQuery = () =>
  vi
    .mocked(validateGetCatalogValuationsQuery)
    .mockResolvedValue({ accountId, catalogId, limit: 30 });

const okCatalog = () =>
  vi
    .mocked(selectAccountCatalog)
    .mockResolvedValue({ account: accountId, catalog: catalogId } as never);

describe("getCatalogValuationsHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("short-circuits with the validator error (auth + params live in the validator)", async () => {
    const denied = NextResponse.json({ status: "error" }, { status: 401 });
    vi.mocked(validateGetCatalogValuationsQuery).mockResolvedValue(denied);

    const response = await getCatalogValuationsHandler(makeRequest(), catalogId);

    expect(response).toBe(denied);
    expect(selectAccountCatalog).not.toHaveBeenCalled();
  });

  it("returns 404 when the catalog is not owned by the caller (or missing)", async () => {
    okQuery();
    vi.mocked(selectAccountCatalog).mockResolvedValue(null);

    const response = await getCatalogValuationsHandler(makeRequest(), catalogId);

    expect(response.status).toBe(404);
    expect(selectCatalogValuations).not.toHaveBeenCalled();
  });

  it("returns the valuation series shaped to the documented contract", async () => {
    okQuery();
    okCatalog();
    const rows = [
      {
        id: "v2",
        catalog_id: catalogId,
        low: "1000",
        mid: "2000",
        high: "3000",
        measured_song_count: 12,
        total_streams: 456789,
        measured_at: "2026-07-29T00:00:00Z",
        created_at: "2026-07-29T00:00:00Z",
      },
    ];
    vi.mocked(selectCatalogValuations).mockResolvedValue(rows as never);

    const response = await getCatalogValuationsHandler(makeRequest(), catalogId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(selectCatalogValuations).toHaveBeenCalledWith({ catalogId, limit: 30 });
    expect(body.valuations).toEqual([
      {
        low: 1000,
        mid: 2000,
        high: 3000,
        measured_song_count: 12,
        total_streams: 456789,
        measured_at: "2026-07-29T00:00:00Z",
      },
    ]);
  });

  it("returns an empty series when the catalog has no valuations yet", async () => {
    okQuery();
    okCatalog();
    vi.mocked(selectCatalogValuations).mockResolvedValue([]);

    const response = await getCatalogValuationsHandler(makeRequest(), catalogId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.valuations).toEqual([]);
  });

  it("returns 500 when the select fails", async () => {
    okQuery();
    okCatalog();
    vi.mocked(selectCatalogValuations).mockResolvedValue(null);

    const response = await getCatalogValuationsHandler(makeRequest(), catalogId);

    expect(response.status).toBe(500);
  });
});
