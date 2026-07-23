import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { sendValuationReportEmail } from "../sendValuationReportEmail";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { logEmailAttempt } from "@/lib/emails/logEmailAttempt";
import { selectEmailSendLog } from "@/lib/supabase/email_send_log/selectEmailSendLog";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { selectCatalogById } from "@/lib/supabase/catalogs/selectCatalogById";
import { selectCatalogMeasurementsAggregate } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate";
import { selectCatalogMeasurementsPage } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsPage";
import { selectCatalogSongsWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";
import { getCatalogEarliestReleaseDate } from "@/lib/catalog/getCatalogEarliestReleaseDate";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getAlbums from "@/lib/spotify/getAlbums";
import { RECOUP_FROM_EMAIL } from "@/lib/const";
import type { SpotifyArtist } from "@/types/spotify.types";
import type { Tables } from "@/types/database.types";

vi.mock("@/lib/emails/sendEmail", () => ({ sendEmailWithResend: vi.fn() }));
vi.mock("@/lib/emails/logEmailAttempt", () => ({ logEmailAttempt: vi.fn() }));
vi.mock("@/lib/supabase/email_send_log/selectEmailSendLog", () => ({
  selectEmailSendLog: vi.fn(),
}));
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({ default: vi.fn() }));
vi.mock("@/lib/supabase/catalogs/selectCatalogById", () => ({ selectCatalogById: vi.fn() }));
vi.mock("@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate", () => ({
  selectCatalogMeasurementsAggregate: vi.fn(),
}));
vi.mock("@/lib/supabase/song_measurements/selectCatalogMeasurementsPage", () => ({
  selectCatalogMeasurementsPage: vi.fn(),
}));
vi.mock("@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists", () => ({
  selectCatalogSongsWithArtists: vi.fn(),
}));
vi.mock("@/lib/catalog/getCatalogEarliestReleaseDate", () => ({
  getCatalogEarliestReleaseDate: vi.fn(),
}));
vi.mock("@/lib/spotify/generateAccessToken", () => ({ default: vi.fn() }));
vi.mock("@/lib/spotify/getAlbums", () => ({ default: vi.fn() }));

const snapshot = {
  id: "snap_1",
  account: "acc_1",
  catalog: "cat_1",
  album_count: 10,
  album_ids: ["al_1"],
  state: "done",
} as Tables<"playcount_snapshots">;

const artist = {
  name: "Epitaph",
  images: [{ url: "https://art/artist.jpg", height: 640, width: 640 }],
  followers: { total: 50_000 },
} as SpotifyArtist;

function arrange() {
  vi.mocked(selectEmailSendLog).mockResolvedValue([]);
  vi.mocked(selectAccountEmails).mockResolvedValue([
    { email: "digital@epitaph.com", account_id: "acc_1" } as Tables<"account_emails">,
  ]);
  vi.mocked(selectCatalogById).mockResolvedValue({
    id: "cat_1",
    name: "Epitaph Catalog",
  } as Tables<"catalogs">);
  vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
    measuredSongCount: 112,
    totalStreams: 3_480_000,
  });
  vi.mocked(getCatalogEarliestReleaseDate).mockResolvedValue("2016-01-01");
  vi.mocked(selectCatalogSongsWithArtists).mockResolvedValue({
    songs: [
      { isrc: "US1", album: "Epitaph Hits", artists: [{ name: "Epitaph" }] },
    ] as never,
    total_count: 1,
  });
  vi.mocked(selectCatalogMeasurementsPage).mockResolvedValue([
    { isrc: "US1", title: "Track", playcount: 3_480_000, measured_at: "2026-07-22" },
  ]);
  vi.mocked(generateAccessToken).mockResolvedValue({
    access_token: "tok",
    token_type: "Bearer",
    expires_in: 3600,
    error: null,
  });
  vi.mocked(getAlbums).mockResolvedValue({
    albums: [
      {
        id: "al_1",
        name: "Epitaph Hits",
        images: [
          { url: "https://art/big.jpg", height: 640, width: 640 },
          { url: "https://art/small.jpg", height: 64, width: 64 },
        ],
      },
    ],
    error: null,
  });
  vi.mocked(sendEmailWithResend).mockResolvedValue({ id: "resend_1" });
}

describe("sendValuationReportEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    arrange();
  });

  it("sends the rich report (artist header + release table) and logs the send", async () => {
    const result = await sendValuationReportEmail(snapshot, { artist });

    expect(sendEmailWithResend).toHaveBeenCalledTimes(1);
    const [payload, options] = vi.mocked(sendEmailWithResend).mock.calls[0];
    expect(payload.from).toBe(RECOUP_FROM_EMAIL);
    expect(payload.to).toEqual(["digital@epitaph.com"]);
    expect(payload.subject).toBe("Your catalog valuation is ready");
    expect(payload.html).toContain("Epitaph Catalog");
    expect(payload.html).toContain("https://chat.recoupable.dev/catalogs/cat_1");
    // artist header
    expect(payload.html).toContain("https://art/artist.jpg");
    expect(payload.html).toContain("50K followers");
    // release table with album art
    expect(payload.html).toContain("Epitaph Hits");
    expect(payload.html).toContain("https://art/small.jpg");
    expect(options).toEqual({ idempotencyKey: "valuation-report/snap_1" });

    const attempt = vi.mocked(logEmailAttempt).mock.calls[0][0];
    expect(attempt.status).toBe("sent");
    expect(attempt.accountId).toBe("acc_1");
    expect(attempt.resendId).toBe("resend_1");
    expect(attempt.rawBody).toContain('"snapshot_id":"snap_1"');
    expect(attempt.rawBody).toContain('"type":"valuation_report"');

    expect(result).toEqual({ sent: true, resendId: "resend_1" });
  });

  it("skips without sending when a send is already logged for this snapshot", async () => {
    vi.mocked(selectEmailSendLog).mockResolvedValue([{ id: "log_1" } as Tables<"email_send_log">]);

    const result = await sendValuationReportEmail(snapshot, { artist });

    expect(sendEmailWithResend).not.toHaveBeenCalled();
    expect(logEmailAttempt).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: false, skipped: "already_sent" });
  });

  it("skips when the account has no email address", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue([]);

    const result = await sendValuationReportEmail(snapshot, { artist });

    expect(sendEmailWithResend).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: false, skipped: "no_email" });
  });

  it("falls back to the app link when no catalog was claimed", async () => {
    const result = await sendValuationReportEmail({ ...snapshot, catalog: null });

    expect(selectCatalogById).not.toHaveBeenCalled();
    expect(selectCatalogMeasurementsAggregate).not.toHaveBeenCalled();
    const [payload] = vi.mocked(sendEmailWithResend).mock.calls[0];
    expect(payload.html).toContain('href="https://chat.recoupable.dev"');
    expect(payload.html).not.toContain("/catalogs/");
    expect(result).toEqual({ sent: true, resendId: "resend_1" });
  });

  it("still sends the headline email when the release-table build fails", async () => {
    vi.mocked(selectCatalogSongsWithArtists).mockRejectedValue(new Error("db down"));

    const result = await sendValuationReportEmail(snapshot, { artist });

    const [payload] = vi.mocked(sendEmailWithResend).mock.calls[0];
    expect(payload.html).toContain("Epitaph Catalog");
    expect(payload.html).toContain("$"); // headline band still rendered
    expect(result).toEqual({ sent: true, resendId: "resend_1" });
  });

  it("logs send_failed and reports the failure when Resend rejects the send", async () => {
    vi.mocked(sendEmailWithResend).mockResolvedValue(
      NextResponse.json({ error: "Failed to send email" }, { status: 502 }),
    );

    const result = await sendValuationReportEmail(snapshot, { artist });

    const attempt = vi.mocked(logEmailAttempt).mock.calls[0][0];
    expect(attempt.status).toBe("send_failed");
    expect(result).toEqual({ sent: false, error: "Failed to send email" });
  });
});
