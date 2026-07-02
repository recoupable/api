import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { postArtistSocialsScrapeHandler } from "../postArtistSocialsScrapeHandler";
import { scrapeProfileUrlBatch } from "@/lib/apify/scrapeProfileUrlBatch";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";

vi.mock("@/lib/apify/scrapeProfileUrlBatch", () => ({ scrapeProfileUrlBatch: vi.fn() }));
vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const ARTIST_ID = "660e8400-e29b-41d4-a716-446655440000";

const makeRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/artist/socials/scrape", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("postArtistSocialsScrapeHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selectAccountSocials).mockResolvedValue([
      { social: { profile_url: "https://x.com/a", username: "a" } } as never,
    ]);
    vi.mocked(scrapeProfileUrlBatch).mockResolvedValue([
      { runId: "r1", datasetId: "d1", error: null },
    ]);
  });

  it("returns 400 when artist_account_id is missing", async () => {
    const res = await postArtistSocialsScrapeHandler(makeRequest({}));
    expect(res.status).toBe(400);
    expect(scrapeProfileUrlBatch).not.toHaveBeenCalled();
  });

  it("scrapes without a posts depth by default (legacy behavior)", async () => {
    const res = await postArtistSocialsScrapeHandler(makeRequest({ artist_account_id: ARTIST_ID }));
    expect(res.status).toBe(200);
    expect(scrapeProfileUrlBatch).toHaveBeenCalledWith(
      [{ profileUrl: "https://x.com/a", username: "a" }],
      undefined,
    );
  });

  it("forwards posts to scrapeProfileUrlBatch", async () => {
    await postArtistSocialsScrapeHandler(makeRequest({ artist_account_id: ARTIST_ID, posts: 20 }));
    expect(scrapeProfileUrlBatch).toHaveBeenCalledWith(
      [{ profileUrl: "https://x.com/a", username: "a" }],
      20,
    );
  });

  it("returns [] when the artist has no socials", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue([]);
    const res = await postArtistSocialsScrapeHandler(makeRequest({ artist_account_id: ARTIST_ID }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(scrapeProfileUrlBatch).not.toHaveBeenCalled();
  });
});
