import { describe, it, expect, vi, beforeEach } from "vitest";
import { runArtistSocialsScrape } from "../runArtistSocialsScrape";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { checkCreditsAvailable } from "@/lib/credits/checkCreditsAvailable";
import { startArtistSocialsScrape } from "@/lib/artist/startArtistSocialsScrape";

vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({ checkAccountArtistAccess: vi.fn() }));
vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: vi.fn(),
}));
vi.mock("@/lib/credits/checkCreditsAvailable", () => ({ checkCreditsAvailable: vi.fn() }));
vi.mock("@/lib/artist/startArtistSocialsScrape", () => ({ startArtistSocialsScrape: vi.fn() }));

const ARTIST_ID = "660e8400-e29b-41d4-a716-446655440000";
const SOCIALS = [
  { social: { id: "s1", profile_url: "https://x.com/a", username: "a" } },
  { social: { id: "s2", profile_url: "https://www.instagram.com/b", username: "b" } },
];
const RUNS = [{ runId: "r1", datasetId: "d1", error: null }];

describe("runArtistSocialsScrape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(selectAccountSocials).mockResolvedValue(SOCIALS as never);
    vi.mocked(checkCreditsAvailable).mockResolvedValue({ kind: "available" });
    vi.mocked(startArtistSocialsScrape).mockResolvedValue(RUNS);
  });

  it("gates credits for every linked profile, then starts under the route's usage label", async () => {
    const result = await runArtistSocialsScrape({
      accountId: "acct",
      artistAccountId: ARTIST_ID,
      posts: 5,
    });
    expect(checkAccountArtistAccess).toHaveBeenCalledWith("acct", ARTIST_ID);
    expect(selectAccountSocials).toHaveBeenCalledWith({ accountId: ARTIST_ID });
    // (50,000 + 5 × 10,000) × 2 profiles
    expect(checkCreditsAvailable).toHaveBeenCalledWith({
      accountId: "acct",
      creditsToDeduct: 200_000,
    });
    expect(startArtistSocialsScrape).toHaveBeenCalledWith({
      accountId: "acct",
      socials: SOCIALS,
      posts: 5,
      costPerProfile: 100_000,
      modelId: "POST /api/artist/socials/scrape",
    });
    expect(result).toEqual({ kind: "started", runs: RUNS });
  });

  it("returns forbidden and reads nothing for an inaccessible artist", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);
    const result = await runArtistSocialsScrape({ accountId: "acct", artistAccountId: ARTIST_ID });
    expect(result).toEqual({ kind: "forbidden" });
    expect(selectAccountSocials).not.toHaveBeenCalled();
    expect(startArtistSocialsScrape).not.toHaveBeenCalled();
  });

  it("starts nothing and gates nothing without linked socials", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue([]);
    const result = await runArtistSocialsScrape({ accountId: "acct", artistAccountId: ARTIST_ID });
    expect(result).toEqual({ kind: "started", runs: [] });
    expect(checkCreditsAvailable).not.toHaveBeenCalled();
    expect(startArtistSocialsScrape).not.toHaveBeenCalled();
  });

  it("returns the shortfall and starts nothing when credits are short", async () => {
    vi.mocked(checkCreditsAvailable).mockResolvedValue({
      kind: "insufficient_credits",
      remainingCredits: 10,
      requiredCredits: 100_000,
    });
    const result = await runArtistSocialsScrape({ accountId: "acct", artistAccountId: ARTIST_ID });
    expect(result).toEqual({
      kind: "insufficient_credits",
      remainingCredits: 10,
      requiredCredits: 100_000,
    });
    expect(startArtistSocialsScrape).not.toHaveBeenCalled();
  });
});
