import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getCatalogMeasurementsHandler } from "../getCatalogMeasurementsHandler";
import { validateGetCatalogMeasurementsQuery } from "../validateGetCatalogMeasurementsQuery";
import { getCatalogEarliestReleaseDate } from "../getCatalogEarliestReleaseDate";
import { resolveCatalogSongsInScope } from "../resolveCatalogSongsInScope";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";
import { selectAllSongMeasurements } from "@/lib/supabase/song_measurements/selectAllSongMeasurements";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("../validateGetCatalogMeasurementsQuery", () => ({
  validateGetCatalogMeasurementsQuery: vi.fn(),
}));
vi.mock("../getCatalogEarliestReleaseDate", () => ({ getCatalogEarliestReleaseDate: vi.fn() }));
vi.mock("../resolveCatalogSongsInScope", () => ({ resolveCatalogSongsInScope: vi.fn() }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalog", () => ({
  selectAccountCatalog: vi.fn(),
}));
vi.mock("@/lib/supabase/song_measurements/selectAllSongMeasurements", () => ({
  selectAllSongMeasurements: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const catalogId = "740d5050-40ec-4892-a040-b78bb50fef2f";
const artistAccountId = "b1814076-8e19-4a77-9dea-2ec150e26aaa";

const makeRequest = () =>
  new NextRequest(`http://localhost/api/catalogs/measurements?catalogId=${catalogId}`);

const okAuth = () =>
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId,
    orgId: null,
    authToken: "t",
  } as never);

const okQuery = (query: Record<string, string> = { catalogId }) =>
  vi.mocked(validateGetCatalogMeasurementsQuery).mockReturnValue(query as never);

const okCatalog = () =>
  vi.mocked(selectAccountCatalog).mockResolvedValue({
    account: accountId,
    catalog: catalogId,
  } as never);

describe("getCatalogMeasurementsHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("short-circuits with the validator error and never authenticates", async () => {
    const err = NextResponse.json({ status: "error" }, { status: 400 });
    vi.mocked(validateGetCatalogMeasurementsQuery).mockReturnValue(err);

    const res = await getCatalogMeasurementsHandler(makeRequest());

    expect(res).toBe(err);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("short-circuits with the auth error when unauthenticated", async () => {
    okQuery();
    const authErr = NextResponse.json({ status: "error" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authErr);

    const res = await getCatalogMeasurementsHandler(makeRequest());

    expect(res).toBe(authErr);
    expect(selectAccountCatalog).not.toHaveBeenCalled();
  });

  it("returns 404 when the catalog does not belong to the caller", async () => {
    okQuery();
    okAuth();
    vi.mocked(selectAccountCatalog).mockResolvedValue(null);

    const res = await getCatalogMeasurementsHandler(makeRequest());

    expect(res.status).toBe(404);
    expect(selectAccountCatalog).toHaveBeenCalledWith({ accountId, catalogId });
    expect(resolveCatalogSongsInScope).not.toHaveBeenCalled();
  });

  it("returns latest per-ISRC measurements + the derived valuation band", async () => {
    okQuery();
    okAuth();
    okCatalog();
    vi.mocked(resolveCatalogSongsInScope).mockResolvedValue([
      { isrc: "ISRC1", title: "Song One" },
      { isrc: "ISRC2", title: "Song Two" },
    ]);
    vi.mocked(selectAllSongMeasurements).mockResolvedValue([
      // newest-first series; ISRC1 has an older superseded capture
      { song: "ISRC1", value: 200, captured_at: "2026-07-01T00:00:00Z" },
      { song: "ISRC2", value: 50, captured_at: "2026-07-01T00:00:00Z" },
      { song: "ISRC1", value: 100, captured_at: "2026-06-01T00:00:00Z" },
    ] as never);
    // 10 years of catalog age
    vi.mocked(getCatalogEarliestReleaseDate).mockResolvedValue("2016-07-01");

    const res = await getCatalogMeasurementsHandler(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(resolveCatalogSongsInScope).toHaveBeenCalledWith({
      catalogId,
      artistAccountId: undefined,
    });
    expect(selectAllSongMeasurements).toHaveBeenCalledWith({
      songs: ["ISRC1", "ISRC2"],
      platform: "spotify",
      metric: "platform_displayed_play_count",
    });
    expect(body.status).toBe("success");
    expect(body.measurements).toEqual([
      { isrc: "ISRC1", title: "Song One", playcount: 200, measured_at: "2026-07-01T00:00:00Z" },
      { isrc: "ISRC2", title: "Song Two", playcount: 50, measured_at: "2026-07-01T00:00:00Z" },
    ]);
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
    okQuery({ catalogId, artist_account_id: artistAccountId });
    okAuth();
    okCatalog();
    vi.mocked(resolveCatalogSongsInScope).mockResolvedValue([{ isrc: "ISRC1", title: "Song One" }]);
    vi.mocked(selectAllSongMeasurements).mockResolvedValue([
      { song: "ISRC1", value: 200, captured_at: "2026-07-01T00:00:00Z" },
    ] as never);
    vi.mocked(getCatalogEarliestReleaseDate).mockResolvedValue("2016-07-01");

    const res = await getCatalogMeasurementsHandler(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(resolveCatalogSongsInScope).toHaveBeenCalledWith({ catalogId, artistAccountId });
    expect(body.measurements).toEqual([
      { isrc: "ISRC1", title: "Song One", playcount: 200, measured_at: "2026-07-01T00:00:00Z" },
    ]);
    expect(body.total_streams).toBe(200);
    expect(body.artist_account_id).toBe(artistAccountId);
  });

  it("returns an empty result with a zero band when the artist has no songs in the catalog", async () => {
    okQuery({ catalogId, artist_account_id: artistAccountId });
    okAuth();
    okCatalog();
    vi.mocked(resolveCatalogSongsInScope).mockResolvedValue([]);
    vi.mocked(getCatalogEarliestReleaseDate).mockResolvedValue(null);

    const res = await getCatalogMeasurementsHandler(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(selectAllSongMeasurements).not.toHaveBeenCalled();
    expect(body.measurements).toEqual([]);
    expect(body.total_streams).toBe(0);
    expect(body.valuation).toEqual({ low: 0, mid: 0, high: 0 });
    expect(body.artist_account_id).toBe(artistAccountId);
  });

  it("returns an empty result with a zero band for a catalog with no measurements", async () => {
    okQuery();
    okAuth();
    okCatalog();
    vi.mocked(resolveCatalogSongsInScope).mockResolvedValue([]);
    vi.mocked(getCatalogEarliestReleaseDate).mockResolvedValue(null);

    const res = await getCatalogMeasurementsHandler(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.measurements).toEqual([]);
    expect(body.total_streams).toBe(0);
    expect(body.valuation).toEqual({ low: 0, mid: 0, high: 0 });
    expect(body.artist_account_id).toBeNull();
  });

  it("returns 500 when a dependency throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    okQuery();
    okAuth();
    vi.mocked(selectAccountCatalog).mockRejectedValue(new Error("boom"));

    const res = await getCatalogMeasurementsHandler(makeRequest());

    expect(res.status).toBe(500);
    consoleError.mockRestore();
  });
});
