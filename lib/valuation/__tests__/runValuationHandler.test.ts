import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse, after } from "next/server";

import { runValuationHandler } from "../runValuationHandler";
import { validateRunValuationRequest } from "../validateRunValuationRequest";
import { waitForSnapshotMeasurements } from "../waitForSnapshotMeasurements";
import { enrichSearchedArtistProfile } from "../enrichSearchedArtistProfile";
import { captureValuationLead } from "../captureValuationLead";
import { sendValuationReportEmail } from "@/lib/emails/valuationReport/sendValuationReportEmail";
import { attachCanonicalArtistToAccount } from "@/lib/catalog/attachCanonicalArtistToAccount";
import { resolveOrCreateArtist } from "@/lib/artists/resolveOrCreateArtist";
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
  // `after` throws outside a request scope — run its callback inline so the
  // deferred lead capture is assertable.
  return { ...actual, after: vi.fn((cb: () => unknown) => cb()) };
});
vi.mock("../validateRunValuationRequest", () => ({ validateRunValuationRequest: vi.fn() }));
vi.mock("../waitForSnapshotMeasurements", () => ({ waitForSnapshotMeasurements: vi.fn() }));
vi.mock("@/lib/catalog/attachCanonicalArtistToAccount", () => ({
  attachCanonicalArtistToAccount: vi.fn(),
}));
vi.mock("@/lib/artists/resolveOrCreateArtist", () => ({ resolveOrCreateArtist: vi.fn() }));
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

/** The after() mock returns each callback's promise; flush them before asserting. */
const flushAfter = () => Promise.all(vi.mocked(after).mock.results.map(r => r.value));

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
    isrcs: ["ISRC_A"],
  });
  vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
    measuredSongCount: 12,
    totalStreams: 1_000_000,
  });
  vi.mocked(getCatalogEarliestReleaseDate).mockResolvedValue("2020-01-01");
  vi.mocked(sendValuationReportEmail).mockResolvedValue({ sent: true, resendId: "re_1" });
  vi.mocked(captureValuationLead).mockResolvedValue(undefined);
  vi.mocked(attachCanonicalArtistToAccount).mockResolvedValue(null);
  vi.mocked(resolveOrCreateArtist).mockResolvedValue({ artist: null, created: false });
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

  // Roster attach: one sequence, one catch site (chat#1965).
  describe("roster attach", () => {
    const withArtist = () =>
      vi.mocked(getArtist).mockResolvedValue({
        artist: { name: "Bad Bunny" } as Awaited<ReturnType<typeof getArtist>>["artist"],
        error: null,
      });

    it("attaches the canonical artist from the measured ISRCs and enriches it", async () => {
      happyPath();
      withArtist();
      vi.mocked(attachCanonicalArtistToAccount).mockResolvedValue("canonical-1");

      const res = await runValuationHandler(makeRequest());
      await flushAfter();

      expect(res.status).toBe(200);
      expect(attachCanonicalArtistToAccount).toHaveBeenCalledWith({
        accountId,
        isrcs: ["ISRC_A"],
      });
      expect(resolveOrCreateArtist).not.toHaveBeenCalled();
      expect(enrichSearchedArtistProfile).toHaveBeenCalledWith(
        expect.objectContaining({ artistId: "canonical-1" }),
      );
      expect(captureValuationLead).toHaveBeenCalledWith(
        expect.objectContaining({ rosterArtistId: "canonical-1" }),
      );
      expect(vi.mocked(captureValuationLead).mock.calls[0][0].rosterAttachError).toBeUndefined();
    });

    it("falls back to the shared resolver when the song graph resolves nothing", async () => {
      happyPath();
      withArtist();
      vi.mocked(sendValuationReportEmail).mockResolvedValue({ sent: true, resendId: "re_1" });
      vi.mocked(captureValuationLead).mockResolvedValue(undefined);
      vi.mocked(attachCanonicalArtistToAccount).mockResolvedValue(null);
      vi.mocked(resolveOrCreateArtist).mockResolvedValue({
        artist: { id: "canonical-2", account_id: "canonical-2", name: "Bad Bunny" } as never,
        created: false,
      });

      const res = await runValuationHandler(makeRequest());
      await flushAfter();

      expect(res.status).toBe(200);
      expect(resolveOrCreateArtist).toHaveBeenCalledWith({
        name: "Bad Bunny",
        accountId,
        spotifyArtistId: "spotify-artist-1",
      });
      expect(enrichSearchedArtistProfile).toHaveBeenCalledWith(
        expect.objectContaining({ artistId: "canonical-2" }),
      );
      expect(captureValuationLead).toHaveBeenCalledWith(
        expect.objectContaining({ rosterArtistId: "canonical-2" }),
      );
    });

    it("reports nothing attached when both the graph and the resolver come up empty", async () => {
      happyPath();
      withArtist();
      vi.mocked(attachCanonicalArtistToAccount).mockResolvedValue(null);
      vi.mocked(resolveOrCreateArtist).mockResolvedValue({ artist: null, created: false });

      const res = await runValuationHandler(makeRequest());
      await flushAfter();

      expect(res.status).toBe(200);
      expect(enrichSearchedArtistProfile).not.toHaveBeenCalled();
      expect(captureValuationLead).toHaveBeenCalledWith(
        expect.objectContaining({ rosterArtistId: null }),
      );
      expect(vi.mocked(captureValuationLead).mock.calls[0][0].rosterAttachError).toBeUndefined();
    });

    it("a failed attach never fails the valuation and surfaces in the lead alert", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      happyPath();
      withArtist();
      vi.mocked(attachCanonicalArtistToAccount).mockRejectedValue(new Error("link exploded"));

      const res = await runValuationHandler(makeRequest());
      await flushAfter();

      expect(res.status).toBe(200);
      expect(enrichSearchedArtistProfile).not.toHaveBeenCalled();
      expect(captureValuationLead).toHaveBeenCalledWith(
        expect.objectContaining({
          rosterArtistId: null,
          rosterAttachError: "link exploded",
        }),
      );
      consoleSpy.mockRestore();
    });

    it("a failed fallback resolve also surfaces in the lead alert", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      happyPath();
      withArtist();
      vi.mocked(sendValuationReportEmail).mockResolvedValue({ sent: true, resendId: "re_1" });
      vi.mocked(captureValuationLead).mockResolvedValue(undefined);
      vi.mocked(attachCanonicalArtistToAccount).mockResolvedValue(null);
      vi.mocked(resolveOrCreateArtist).mockRejectedValue(new Error("resolver exploded"));

      const res = await runValuationHandler(makeRequest());
      await flushAfter();

      expect(res.status).toBe(200);
      expect(captureValuationLead).toHaveBeenCalledWith(
        expect.objectContaining({
          rosterArtistId: null,
          rosterAttachError: "resolver exploded",
        }),
      );
      consoleSpy.mockRestore();
    });
  });

  // The email consumes the handler's computed valuation and only fires with
  // numbers; the lead alert reports the actual outcome (chat#1969).
  describe("valuation email gate + outcome", () => {
    const withArtist = () =>
      vi.mocked(getArtist).mockResolvedValue({
        artist: { name: "Bad Bunny" } as Awaited<ReturnType<typeof getArtist>>["artist"],
        error: null,
      });

    it("passes the computed valuation to the email and reports sent", async () => {
      happyPath();
      withArtist();

      const res = await runValuationHandler(makeRequest());
      await flushAfter();

      expect(res.status).toBe(200);
      expect(sendValuationReportEmail).toHaveBeenCalledTimes(1);
      const emailArgs = vi.mocked(sendValuationReportEmail).mock.calls[0][0];
      expect(emailArgs).toMatchObject({
        catalogId,
        catalogName: "Bad Bunny",
        totalStreams: 1_000_000,
        measuredSongCount: 12,
      });
      // The handler's own band, computed once for the API response.
      expect(emailArgs.valuation.mid).toBeGreaterThan(0);
      expect(captureValuationLead).toHaveBeenCalledWith(
        expect.objectContaining({ emailOutcome: { status: "sent" } }),
      );
    });

    it("never calls the email for a zero-stream catalog and reports the skip", async () => {
      happyPath();
      withArtist();
      vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
        measuredSongCount: 29,
        totalStreams: 0,
      });

      const res = await runValuationHandler(makeRequest());
      await flushAfter();

      expect(res.status).toBe(200);
      expect(sendValuationReportEmail).not.toHaveBeenCalled();
      expect(captureValuationLead).toHaveBeenCalledWith(
        expect.objectContaining({
          emailOutcome: { status: "skipped", reason: "0 streams" },
        }),
      );
    });

    it("reports a no-measurements skip when the aggregate is unavailable", async () => {
      happyPath();
      withArtist();
      vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue(null);

      const res = await runValuationHandler(makeRequest());
      await flushAfter();

      expect(res.status).toBe(200);
      expect(sendValuationReportEmail).not.toHaveBeenCalled();
      expect(captureValuationLead).toHaveBeenCalledWith(
        expect.objectContaining({
          emailOutcome: { status: "skipped", reason: "no measurements" },
        }),
      );
    });

    it("reports a deduped send as skipped (already sent)", async () => {
      happyPath();
      withArtist();
      vi.mocked(sendValuationReportEmail).mockResolvedValue({
        sent: false,
        skipped: "already_sent",
      });

      await runValuationHandler(makeRequest());
      await flushAfter();

      expect(captureValuationLead).toHaveBeenCalledWith(
        expect.objectContaining({
          emailOutcome: { status: "skipped", reason: "already sent" },
        }),
      );
    });

    it("a thrown email send never fails the valuation and reports the failure", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      happyPath();
      withArtist();
      vi.mocked(sendValuationReportEmail).mockRejectedValue(new Error("resend down"));

      const res = await runValuationHandler(makeRequest());
      await flushAfter();

      expect(res.status).toBe(200);
      expect(captureValuationLead).toHaveBeenCalledWith(
        expect.objectContaining({
          emailOutcome: { status: "failed", error: "resend down" },
        }),
      );
      consoleSpy.mockRestore();
    });
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
