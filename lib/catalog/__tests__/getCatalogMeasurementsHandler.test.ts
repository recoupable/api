import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getCatalogMeasurementsHandler } from "../getCatalogMeasurementsHandler";
import { validateGetCatalogMeasurementsQuery } from "../validateGetCatalogMeasurementsQuery";
import { getCatalogEarliestReleaseDate } from "../getCatalogEarliestReleaseDate";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";
import { selectCatalogMeasurementsAggregate } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate";
import { selectCatalogMeasurementsPage } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsPage";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("../validateGetCatalogMeasurementsQuery", () => ({
  validateGetCatalogMeasurementsQuery: vi.fn(),
}));
vi.mock("../getCatalogEarliestReleaseDate", () => ({ getCatalogEarliestReleaseDate: vi.fn() }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalog", () => ({
  selectAccountCatalog: vi.fn(),
}));
vi.mock("@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate", () => ({
  selectCatalogMeasurementsAggregate: vi.fn(),
}));
vi.mock("@/lib/supabase/song_measurements/selectCatalogMeasurementsPage", () => ({
  selectCatalogMeasurementsPage: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const catalogId = "740d5050-40ec-4892-a040-b78bb50fef2f";
const artistAccountId = "b1814076-8e19-4a77-9dea-2ec150e26aaa";

const makeRequest = () =>
  new NextRequest(`http://localhost/api/catalogs/${catalogId}/measurements`);

const okAuth = () =>
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId,
    orgId: null,
    authToken: "t",
  } as never);

const okQuery = (query: Record<string, unknown> = { catalogId, page: 1, limit: 50 }) =>
  vi.mocked(validateGetCatalogMeasurementsQuery).mockReturnValue(query as never);

const okCatalog = () =>
  vi.mocked(selectAccountCatalog).mockResolvedValue({
    account: accountId,
    catalog: catalogId,
  } as never);

const pageRows = [
  { isrc: "ISRC1", title: "Song One", playcount: 200, measured_at: "2026-07-01T00:00:00Z" },
  { isrc: "ISRC2", title: "Song Two", playcount: 50, measured_at: "2026-07-01T00:00:00Z" },
];

describe("getCatalogMeasurementsHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("short-circuits with the validator error and never authenticates", async () => {
    const err = NextResponse.json({ status: "error" }, { status: 400 });
    vi.mocked(validateGetCatalogMeasurementsQuery).mockReturnValue(err);

    const res = await getCatalogMeasurementsHandler(makeRequest(), catalogId);

    expect(res).toBe(err);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("short-circuits with the auth error when unauthenticated", async () => {
    okQuery();
    const authErr = NextResponse.json({ status: "error" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authErr);

    const res = await getCatalogMeasurementsHandler(makeRequest(), catalogId);

    expect(res).toBe(authErr);
    expect(selectAccountCatalog).not.toHaveBeenCalled();
  });

  it("returns 404 when the catalog does not belong to the caller", async () => {
    okQuery();
    okAuth();
    vi.mocked(selectAccountCatalog).mockResolvedValue(null);

    const res = await getCatalogMeasurementsHandler(makeRequest(), catalogId);

    expect(res.status).toBe(404);
    expect(selectAccountCatalog).toHaveBeenCalledWith({ accountId, catalogId });
    expect(selectCatalogMeasurementsAggregate).not.toHaveBeenCalled();
  });

  it("returns one page of measurements + whole-scope aggregates and the derived band", async () => {
    okQuery();
    okAuth();
    okCatalog();
    // whole-scope aggregate is bigger than the returned page
    vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
      measuredSongCount: 120,
      totalStreams: 250,
    });
    vi.mocked(selectCatalogMeasurementsPage).mockResolvedValue(pageRows);
    // 10 years of catalog age
    vi.mocked(getCatalogEarliestReleaseDate).mockResolvedValue("2016-07-01");

    const res = await getCatalogMeasurementsHandler(makeRequest(), catalogId);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(validateGetCatalogMeasurementsQuery).toHaveBeenCalledWith(
      expect.any(URLSearchParams),
      catalogId,
    );
    expect(selectCatalogMeasurementsAggregate).toHaveBeenCalledWith({
      catalogId,
      artistAccountId: undefined,
    });
    expect(selectCatalogMeasurementsPage).toHaveBeenCalledWith({
      catalogId,
      artistAccountId: undefined,
      page: 1,
      limit: 50,
    });
    expect(body.status).toBe("success");
    expect(body.measurements).toEqual(pageRows);
    expect(body.pagination).toEqual({
      total_count: 120,
      page: 1,
      limit: 50,
      total_pages: 3,
    });
    expect(body.measured_song_count).toBe(120);
    expect(body.total_streams).toBe(250);
    expect(body.catalog_age_years).toBe(10);
    // whole-catalog read: the echo field states no artist filter was applied
    expect(body.artist_account_id).toBeNull();
    // 250 streams / 10y * $0.0035 * gross-up * 0.6375 net * multiple
    expect(body.valuation.low).toBeCloseTo(25 * 0.0035 * 1.25 * 0.6375 * 10, 5);
    expect(body.valuation.mid).toBeCloseTo(25 * 0.0035 * 1.4 * 0.6375 * 13, 5);
    expect(body.valuation.high).toBeCloseTo(25 * 0.0035 * 1.6 * 0.6375 * 16, 5);
  });

  it("scopes the read to the artist and echoes the applied filter", async () => {
    okQuery({ catalogId, artist_account_id: artistAccountId, page: 2, limit: 10 });
    okAuth();
    okCatalog();
    vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
      measuredSongCount: 11,
      totalStreams: 200,
    });
    vi.mocked(selectCatalogMeasurementsPage).mockResolvedValue([pageRows[0]]);
    vi.mocked(getCatalogEarliestReleaseDate).mockResolvedValue("2016-07-01");

    const res = await getCatalogMeasurementsHandler(makeRequest(), catalogId);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(selectCatalogMeasurementsAggregate).toHaveBeenCalledWith({
      catalogId,
      artistAccountId,
    });
    expect(selectCatalogMeasurementsPage).toHaveBeenCalledWith({
      catalogId,
      artistAccountId,
      page: 2,
      limit: 10,
    });
    expect(body.measurements).toEqual([pageRows[0]]);
    expect(body.pagination).toEqual({ total_count: 11, page: 2, limit: 10, total_pages: 2 });
    expect(body.measured_song_count).toBe(11);
    expect(body.total_streams).toBe(200);
    expect(body.artist_account_id).toBe(artistAccountId);
  });

  it("returns an empty page with a zero band when nothing is measured in scope", async () => {
    okQuery({ catalogId, artist_account_id: artistAccountId, page: 1, limit: 50 });
    okAuth();
    okCatalog();
    vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
      measuredSongCount: 0,
      totalStreams: 0,
    });
    vi.mocked(selectCatalogMeasurementsPage).mockResolvedValue([]);
    vi.mocked(getCatalogEarliestReleaseDate).mockResolvedValue(null);

    const res = await getCatalogMeasurementsHandler(makeRequest(), catalogId);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.measurements).toEqual([]);
    expect(body.pagination).toEqual({ total_count: 0, page: 1, limit: 50, total_pages: 0 });
    expect(body.measured_song_count).toBe(0);
    expect(body.total_streams).toBe(0);
    expect(body.valuation).toEqual({ low: 0, mid: 0, high: 0 });
    expect(body.artist_account_id).toBe(artistAccountId);
  });

  it("returns 500 when the aggregate read fails", async () => {
    okQuery();
    okAuth();
    okCatalog();
    vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue(null);
    vi.mocked(selectCatalogMeasurementsPage).mockResolvedValue(pageRows);
    vi.mocked(getCatalogEarliestReleaseDate).mockResolvedValue(null);

    const res = await getCatalogMeasurementsHandler(makeRequest(), catalogId);

    expect(res.status).toBe(500);
  });

  it("returns 500 when the page read fails", async () => {
    okQuery();
    okAuth();
    okCatalog();
    vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
      measuredSongCount: 1,
      totalStreams: 1,
    });
    vi.mocked(selectCatalogMeasurementsPage).mockResolvedValue(null);
    vi.mocked(getCatalogEarliestReleaseDate).mockResolvedValue(null);

    const res = await getCatalogMeasurementsHandler(makeRequest(), catalogId);

    expect(res.status).toBe(500);
  });

  it("returns 500 when a dependency throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    okQuery();
    okAuth();
    vi.mocked(selectAccountCatalog).mockRejectedValue(new Error("boom"));

    const res = await getCatalogMeasurementsHandler(makeRequest(), catalogId);

    expect(res.status).toBe(500);
    consoleError.mockRestore();
  });
});
