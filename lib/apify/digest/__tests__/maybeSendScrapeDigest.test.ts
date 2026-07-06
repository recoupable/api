import { describe, it, expect, vi, beforeEach } from "vitest";
import { maybeSendScrapeDigest } from "@/lib/apify/digest/maybeSendScrapeDigest";
import { selectApifyScraperRunsByBatch } from "@/lib/supabase/apify_scraper_runs/selectApifyScraperRunsByBatch";
import { getScrapeDigestRecipients } from "@/lib/apify/digest/getScrapeDigestRecipients";
import { sendScrapeDigestEmail } from "@/lib/apify/digest/sendScrapeDigestEmail";
import { selectRecentScrapeDigestLogs } from "@/lib/supabase/email_send_log/selectRecentScrapeDigestLogs";
import { logEmailAttempt } from "@/lib/emails/logEmailAttempt";

vi.mock("@/lib/supabase/apify_scraper_runs/selectApifyScraperRunsByBatch", () => ({
  selectApifyScraperRunsByBatch: vi.fn(),
}));
vi.mock("@/lib/apify/digest/getScrapeDigestRecipients", () => ({
  getScrapeDigestRecipients: vi.fn(),
}));
vi.mock("@/lib/apify/digest/sendScrapeDigestEmail", () => ({
  sendScrapeDigestEmail: vi.fn(),
}));
vi.mock("@/lib/supabase/email_send_log/selectRecentScrapeDigestLogs", () => ({
  selectRecentScrapeDigestLogs: vi.fn(async () => []),
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
  vi.mocked(getScrapeDigestRecipients).mockResolvedValue({
    emails: ["owner@example.com"],
    artistIds: ["artist-1"],
  } as never);
  vi.mocked(sendScrapeDigestEmail).mockResolvedValue({ id: "email-1" } as never);
});

describe("maybeSendScrapeDigest", () => {
  it("does nothing while sibling runs are still incomplete", async () => {
    vi.mocked(selectApifyScraperRunsByBatch).mockResolvedValue([
      run({}),
      run({ run_id: "r2", platform: "tiktok", completed_at: null }),
    ] as never);
    expect(await maybeSendScrapeDigest("b1")).toBeNull();
    expect(sendScrapeDigestEmail).not.toHaveBeenCalled();
  });

  it("sends ONE digest with per-platform new posts when the batch completes", async () => {
    vi.mocked(selectApifyScraperRunsByBatch).mockResolvedValue([
      run({ new_post_urls: ["https://instagram.com/p/1"] }),
      run({ run_id: "r2", platform: "tiktok", new_post_urls: ["https://tiktok.com/v/2"] }),
      run({ run_id: "r3", platform: "x", new_post_urls: [] }),
    ] as never);
    await maybeSendScrapeDigest("b1");
    expect(sendScrapeDigestEmail).toHaveBeenCalledOnce();
    const arg = vi.mocked(sendScrapeDigestEmail).mock.calls[0][0];
    expect(arg.sections).toEqual([
      { platform: "instagram", postUrls: ["https://instagram.com/p/1"] },
      { platform: "tiktok", postUrls: ["https://tiktok.com/v/2"] },
    ]); // x omitted — nothing new
    expect(arg.emails).toEqual(["owner@example.com"]);
    // audit trail: the send is recorded per watched artist entity
    expect(logEmailAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "artist-1", status: "sent" }),
    );
  });

  it("suppresses the digest when one was sent for the artist within 24h (rate cap)", async () => {
    vi.mocked(selectApifyScraperRunsByBatch).mockResolvedValue([
      run({ new_post_urls: ["https://instagram.com/p/1"] }),
    ] as never);
    vi.mocked(selectRecentScrapeDigestLogs).mockResolvedValue([
      { account_id: "artist-1", created_at: "2026-07-07T00:00:00Z" },
    ] as never);
    expect(await maybeSendScrapeDigest("b1")).toBeNull();
    expect(sendScrapeDigestEmail).not.toHaveBeenCalled();
  });

  it("sends nothing when the batch completes with zero new posts anywhere", async () => {
    vi.mocked(selectApifyScraperRunsByBatch).mockResolvedValue([
      run({}),
      run({ run_id: "r2", platform: "tiktok" }),
    ] as never);
    expect(await maybeSendScrapeDigest("b1")).toBeNull();
    expect(sendScrapeDigestEmail).not.toHaveBeenCalled();
  });

  it("no-ops for a null batch id (legacy runs)", async () => {
    expect(await maybeSendScrapeDigest(null)).toBeNull();
    expect(selectApifyScraperRunsByBatch).not.toHaveBeenCalled();
  });
});
