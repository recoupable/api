import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { runValuationHandler } from "../runValuationHandler";
import { validateRunValuationRequest } from "../validateRunValuationRequest";
import { waitForSnapshotMeasurements } from "../waitForSnapshotMeasurements";
import { linkSearchedArtistToAccount } from "../linkSearchedArtistToAccount";
import { enrichSearchedArtistProfile } from "../enrichSearchedArtistProfile";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getArtist from "@/lib/spotify/getArtist";
import getArtistAlbums from "@/lib/spotify/getArtistAlbums";
import { createMeasurementJob } from "@/lib/research/measurement_jobs/createMeasurementJob";
import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import { createSnapshotCatalog } from "@/lib/catalog/createSnapshotCatalog";
import { selectCatalogMeasurementsAggregate } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate";
import { getCatalogEarliestReleaseDate } from "@/lib/catalog/getCatalogEarliestReleaseDate";

vi.mock("next/server", async importOriginal => {
  const actual = await importOriginal<typeof import("next/server")>();
  // `after` throws outside a request scope; the deferred email + lead capture
  // are not what this suite asserts.
  return { ...actual, after: vi.fn() };
});
vi.mock("../validateRunValuationRequest", () => ({ validateRunValuationRequest: vi.fn() }));
vi.mock("../waitForSnapshotMeasurements", () => ({ waitForSnapshotMeasurements: vi.fn() }));
vi.mock("../linkSearchedArtistToAccount", () => ({ linkSearchedArtistToAccount: vi.fn() }));
vi.mock("../enrichSearchedArtistProfile", () => ({ enrichSearchedArtistProfile: vi.fn() }));
vi.mock("@/lib/spotify/generateAccessToken", () => ({ default: vi.fn() }));
vi.mock("@/lib/spotify/getArtist", () => ({ default: vi.fn() }));
vi.mock("@/lib/spotify/getArtistAlbums", () => ({ default: vi.fn() }));
vi.mock("@/lib/research/measurement_jobs/createMeasurementJob", () => ({
  createMeasurementJob: vi.fn(),
}));
vi.mock("@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots", () => ({
  selectPlaycountSnapshots: vi.fn(),
}));
vi.mock("@/lib/catalog/createSnapshotCatalog", () => ({ createSnapshotCatalog: vi.fn() }));
vi.mock("@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate", () => ({
  selectCatalogMeasurementsAggregate: vi.fn(),
}));
vi.mock("@/lib/catalog/getCatalogEarliestReleaseDate", () => ({
  getCatalogEarliestReleaseDate: vi.fn(),
}));
vi.mock("@/lib/emails/valuationReport/sendValuationReportEmail", () => ({
  sendValuationReportEmail: vi.fn(),
}));
vi.mock("@/lib/valuation/captureValuationLead", () => ({ captureValuationLead: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const snapshotId = "11111111-2222-3333-4444-555555555555";
const catalogId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const catalog = {
  id: catalogId,
  name: "Bad Bunny",
  created_at: "2026-08-06T00:00:00Z",
  updated_at: "2026-08-06T00:00:00Z",
};

const snapshot = {
  id: snapshotId,
  account: accountId,
  album_count: 1,
  album_ids: ["album-1"],
  catalog: null,
  created_at: "2026-08-06T00:00:00Z",
  estimated_cost_usd: 0,
  isrcs: null,
  platforms: ["spotify"],
  schedule: "once",
  state: "completed",
  updated_at: "2026-08-06T00:00:00Z",
};

const makeRequest = () =>
  new NextRequest("http://localhost/api/valuation", {
    method: "POST",
    body: JSON.stringify({ spotify_artist_id: "spotify-artist-1" }),
  });

/** Everything up to (and including) the catalog materialization succeeds. */
const happyPath = () => {
  vi.mocked(validateRunValuationRequest).mockResolvedValue({
    accountId,
    spotify_artist_id: "spotify-artist-1",
  });
  vi.mocked(generateAccessToken).mockResolvedValue({
    access_token: "spotify-token",
  } as Awaited<ReturnType<typeof generateAccessToken>>);
  vi.mocked(getArtistAlbums).mockResolvedValue({
    data: { items: [{ id: "album-1", release_date: "2020-01-01" }] },
    error: null,
  } as Awaited<ReturnType<typeof getArtistAlbums>>);
  vi.mocked(createMeasurementJob).mockResolvedValue({
    data: { id: snapshotId },
  } as Awaited<ReturnType<typeof createMeasurementJob>>);
  vi.mocked(waitForSnapshotMeasurements).mockResolvedValue(true);
  vi.mocked(selectPlaycountSnapshots).mockResolvedValue([snapshot]);
  vi.mocked(createSnapshotCatalog).mockResolvedValue({
    catalog,
    songsAdded: 12,
    attachedArtistId: null,
  });
  vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
    measuredSongCount: 12,
    totalStreams: 1_000_000,
  });
  vi.mocked(getCatalogEarliestReleaseDate).mockResolvedValue("2020-01-01");
  vi.mocked(linkSearchedArtistToAccount).mockResolvedValue(null);
  vi.mocked(enrichSearchedArtistProfile).mockResolvedValue(undefined);
};

describe("runValuationHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("names the catalog after the measured Spotify artist", async () => {
    happyPath();
    vi.mocked(getArtist).mockResolvedValue({
      artist: { name: "Bad Bunny" } as Awaited<ReturnType<typeof getArtist>>["artist"],
      error: null,
    });

    const res = await runValuationHandler(makeRequest());

    expect(res.status).toBe(200);
    expect(createSnapshotCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ accountId, snapshot, name: "Bad Bunny" }),
    );
  });

  it("resolves the Spotify artist before materializing the catalog", async () => {
    happyPath();
    vi.mocked(getArtist).mockResolvedValue({
      artist: { name: "Bad Bunny" } as Awaited<ReturnType<typeof getArtist>>["artist"],
      error: null,
    });

    await runValuationHandler(makeRequest());

    // The name can only be passed if the lookup is hoisted above the create.
    expect(vi.mocked(getArtist).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(createSnapshotCatalog).mock.invocationCallOrder[0],
    );
  });

  it("still creates the catalog when Spotify does not resolve the artist", async () => {
    happyPath();
    vi.mocked(getArtist).mockResolvedValue({
      artist: null,
      error: new Error("Spotify api request failed"),
    });

    const res = await runValuationHandler(makeRequest());

    expect(res.status).toBe(200);
    expect(createSnapshotCatalog).toHaveBeenCalledTimes(1);
    // No name passed — createSnapshotCatalog applies DEFAULT_CATALOG_NAME.
    expect(vi.mocked(createSnapshotCatalog).mock.calls[0][0].name).toBeUndefined();
  });

  it("treats a blank Spotify name as unresolved rather than naming a catalog nothing", async () => {
    happyPath();
    vi.mocked(getArtist).mockResolvedValue({
      artist: { name: "   " } as Awaited<ReturnType<typeof getArtist>>["artist"],
      error: null,
    });

    await runValuationHandler(makeRequest());

    expect(vi.mocked(createSnapshotCatalog).mock.calls[0][0].name).toBeUndefined();
  });

  it("returns the validator response without measuring when validation fails", async () => {
    const err = NextResponse.json({ status: "error" }, { status: 400 });
    vi.mocked(validateRunValuationRequest).mockResolvedValue(err);

    const res = await runValuationHandler(makeRequest());

    expect(res).toBe(err);
    expect(createMeasurementJob).not.toHaveBeenCalled();
    expect(createSnapshotCatalog).not.toHaveBeenCalled();
  });
});
