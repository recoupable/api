import { describe, it, expect, vi, beforeEach } from "vitest";
import { maybeSendScrapeDigest } from "@/lib/apify/digest/maybeSendScrapeDigest";
import { selectApifyScraperRuns } from "@/lib/supabase/apify_scraper_runs/selectApifyScraperRuns";
import { getScrapeDigestRecipients } from "@/lib/apify/digest/getScrapeDigestRecipients";
import { sendScrapeDigestEmail } from "@/lib/apify/digest/sendScrapeDigestEmail";
import { selectScrapeDigestLogs } from "@/lib/supabase/email_send_log/selectScrapeDigestLogs";
import { logEmailAttempt } from "@/lib/emails/logEmailAttempt";

vi.mock("@/lib/supabase/apify_scraper_runs/selectApifyScraperRuns", () => ({
  selectApifyScraperRuns: vi.fn(),
}));
vi.mock("@/lib/apify/digest/getScrapeDigestRecipients", () => ({
  getScrapeDigestRecipients: vi.fn(),
}));
vi.mock("@/lib/apify/digest/sendScrapeDigestEmail", () => ({
  sendScrapeDigestEmail: vi.fn(),
}));
vi.mock("@/lib/apify/digest/getRunDigestSection", () => ({
  // URL-only translation of a run row — enrichment is unit-tested separately
  getRunDigestSection: vi.fn(async (run: { platform: string; new_post_urls: string[] | null }) =>
    run.new_post_urls?.length
      ? {
          platform: run.platform,
          posts: run.new_post_urls.map((url: string) => ({ url })),
          artistName: run.platform === "instagram" ? "National Geographic" : null,
        }
      : null,
  ),
}));
vi.mock("@/lib/supabase/email_send_log/selectScrapeDigestLogs", () => ({
  selectScrapeDigestLogs: vi.fn(async () => []),
}));
vi.mock("@/lib/emails/logEmailAttempt", () => ({ logEmailAttempt: vi.fn(async () => {}) }));

const run = (over: Record<string, unknown>) => ({
  run_id: "r1",
  batch_id: "b1",
  account_id: "acct-1",
  social_id: "s1",
  platform: "instagram",
  completed_at: "2026-07-07T00:00:00Z",
  new_post_urls: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(selectScrapeDigestLogs).mockResolvedValue([]);
  vi.mocked(getScrapeDigestRecipients).mockResolvedValue({
    emails: ["owner@example.com"],
    artistIds: ["artist-1"],
  } as never);
  vi.mocked(sendScrapeDigestEmail).mockResolvedValue({ id: "email-1" } as never);
});

describe("maybeSendScrapeDigest", () => {
  it("does nothing while sibling runs are still incomplete", async () => {
    vi.mocked(selectApifyScraperRuns).mockResolvedValue([
      run({}),
      run({ run_id: "r2", platform: "tiktok", completed_at: null }),
    ] as never);
    expect(await maybeSendScrapeDigest("b1")).toBeNull();
    expect(sendScrapeDigestEmail).not.toHaveBeenCalled();
  });

  it("sends ONE digest with per-platform new posts when the batch completes, and records the audit trail", async () => {
    vi.mocked(selectApifyScraperRuns).mockResolvedValue([
      run({ new_post_urls: ["https://instagram.com/p/1"] }),
      run({ run_id: "r2", platform: "tiktok", new_post_urls: ["https://tiktok.com/v/2"] }),
      run({ run_id: "r3", platform: "x", new_post_urls: [] }),
    ] as never);
    await maybeSendScrapeDigest("b1");
    expect(sendScrapeDigestEmail).toHaveBeenCalledOnce();
    const arg = vi.mocked(sendScrapeDigestEmail).mock.calls[0][0];
    expect(arg.sections).toEqual([
      {
        platform: "instagram",
        posts: [{ url: "https://instagram.com/p/1" }],
        artistName: "National Geographic",
      },
      { platform: "tiktok", posts: [{ url: "https://tiktok.com/v/2" }], artistName: null },
    ]); // x omitted — nothing new
    expect(arg.emails).toEqual(["owner@example.com"]);
    expect(arg.artistName).toBe("National Geographic");
    // audit trail: the send is recorded per watched artist entity
    expect(logEmailAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        rawBody: "scrape-digest:b1",
        accountId: "artist-1",
        status: "sent",
        resendId: "email-1",
      }),
    );
  });

  it("never sends twice for the same batch — exact idempotency, not a time window", async () => {
    vi.mocked(selectApifyScraperRuns).mockResolvedValue([
      run({ new_post_urls: ["https://instagram.com/p/1"] }),
    ] as never);
    vi.mocked(selectScrapeDigestLogs).mockImplementation(async ({ batchId }: never) =>
      batchId ? ([{ account_id: "artist-1", created_at: "2020-01-01T00:00:00Z" }] as never) : [],
    );
    expect(await maybeSendScrapeDigest("b1")).toBeNull();
    expect(sendScrapeDigestEmail).not.toHaveBeenCalled();
    expect(selectScrapeDigestLogs).toHaveBeenCalledWith({ batchId: "b1" });
  });

  it("suppresses a NEW batch when any watching artist got a digest within 24h (rate cap)", async () => {
    vi.mocked(selectApifyScraperRuns).mockResolvedValue([
      run({ new_post_urls: ["https://instagram.com/p/1"] }),
    ] as never);
    vi.mocked(selectScrapeDigestLogs).mockImplementation(async ({ artistIds }: never) =>
      artistIds ? ([{ account_id: "artist-1", created_at: "2026-07-07T01:00:00Z" }] as never) : [],
    );
    expect(await maybeSendScrapeDigest("b1")).toBeNull();
    expect(sendScrapeDigestEmail).not.toHaveBeenCalled();
  });

  it("sends nothing and logs nothing when the batch completes with zero new posts anywhere", async () => {
    vi.mocked(selectApifyScraperRuns).mockResolvedValue([
      run({}),
      run({ run_id: "r2", platform: "tiktok" }),
    ] as never);
    expect(await maybeSendScrapeDigest("b1")).toBeNull();
    expect(sendScrapeDigestEmail).not.toHaveBeenCalled();
    expect(logEmailAttempt).not.toHaveBeenCalled();
  });

  it("no-ops for a null batch id (legacy runs)", async () => {
    expect(await maybeSendScrapeDigest(null)).toBeNull();
    expect(selectApifyScraperRuns).not.toHaveBeenCalled();
  });
});
