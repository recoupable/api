import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerScrapeArtistSocialsTool } from "../registerScrapeArtistSocialsTool";
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
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));

const ARTIST_ID = "660e8400-e29b-41d4-a716-446655440000";
const SOCIALS = [
  { social: { id: "s1", profile_url: "https://x.com/a", username: "a" } },
  { social: { id: "s2", profile_url: "https://www.instagram.com/b", username: "b" } },
];
const extra = (accountId?: string) =>
  ({
    authInfo: accountId
      ? { token: "t", clientId: accountId, scopes: [], extra: { accountId, orgId: null } }
      : undefined,
  }) as never;
const text = (result: { content: Array<{ text: string }> }) => JSON.parse(result.content[0].text);

describe("registerScrapeArtistSocialsTool", () => {
  let config: { inputSchema: { safeParse: (v: unknown) => { success: boolean } } };
  let handler: (args: unknown, extra: unknown) => Promise<{ content: Array<{ text: string }> }>;

  beforeEach(() => {
    vi.clearAllMocks();
    const server = {
      registerTool: vi.fn((name, c, h) => {
        expect(name).toBe("scrape_artist_socials");
        config = c;
        handler = h;
      }),
    } as unknown as McpServer;
    registerScrapeArtistSocialsTool(server);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(selectAccountSocials).mockResolvedValue(SOCIALS as never);
    vi.mocked(checkCreditsAvailable).mockResolvedValue({ kind: "available" });
    vi.mocked(startArtistSocialsScrape).mockResolvedValue([
      { runId: "r1", datasetId: "d1", error: null },
      { runId: null, datasetId: null, error: "Unsupported platform" },
    ]);
  });

  it("reuses the REST body limits for posts", () => {
    expect(config.inputSchema.safeParse({ artist_account_id: ARTIST_ID, posts: 5 }).success).toBe(
      true,
    );
    expect(config.inputSchema.safeParse({ artist_account_id: ARTIST_ID, posts: 101 }).success).toBe(
      false,
    );
    expect(config.inputSchema.safeParse({}).success).toBe(false);
  });

  it("gates credits for every linked profile, then starts the scrape for the caller", async () => {
    const result = await handler({ artist_account_id: ARTIST_ID, posts: 5 }, extra("acct"));
    expect(checkAccountArtistAccess).toHaveBeenCalledWith("acct", ARTIST_ID);
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
    expect(text(result)).toEqual({
      success: true,
      runs: [
        { runId: "r1", datasetId: "d1", error: null },
        { runId: null, datasetId: null, error: "Unsupported platform" },
      ],
    });
  });

  it("requires authentication", async () => {
    const result = await handler({ artist_account_id: ARTIST_ID }, extra());
    expect(text(result).success).toBe(false);
    expect(startArtistSocialsScrape).not.toHaveBeenCalled();
  });

  it("denies artists the caller cannot access", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);
    const result = await handler({ artist_account_id: ARTIST_ID }, extra("acct"));
    expect(text(result)).toEqual({
      success: false,
      message: "Access denied to specified artist_account_id",
    });
    expect(selectAccountSocials).not.toHaveBeenCalled();
  });

  it("starts nothing and charges nothing without linked socials", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue([]);
    const result = await handler({ artist_account_id: ARTIST_ID }, extra("acct"));
    expect(text(result)).toMatchObject({ success: true, runs: [] });
    expect(checkCreditsAvailable).not.toHaveBeenCalled();
    expect(startArtistSocialsScrape).not.toHaveBeenCalled();
  });

  it("starts nothing when credits are short", async () => {
    vi.mocked(checkCreditsAvailable).mockResolvedValue({
      kind: "insufficient_credits",
      remainingCredits: 10,
      requiredCredits: 100_000,
    });
    const result = await handler({ artist_account_id: ARTIST_ID }, extra("acct"));
    expect(text(result).message).toBe("Insufficient credits: 10 remaining, 100000 required");
    expect(startArtistSocialsScrape).not.toHaveBeenCalled();
  });

  it("returns a tool error with each failure when no run started", async () => {
    vi.mocked(startArtistSocialsScrape).mockResolvedValue([
      { runId: null, datasetId: null, error: "Failed to start scrape" },
      { runId: null, datasetId: null, error: "Unsupported platform" },
    ]);
    const result = await handler({ artist_account_id: ARTIST_ID }, extra("acct"));
    expect(text(result)).toEqual({
      success: false,
      message:
        "No scrape runs started: Failed to start scrape; Unsupported platform. No credits were charged.",
    });
  });

  it("returns a redacted error when the scrape throws", async () => {
    vi.mocked(startArtistSocialsScrape).mockRejectedValue(new Error("apify token bad"));
    const result = await handler({ artist_account_id: ARTIST_ID }, extra("acct"));
    expect(text(result)).toEqual({
      success: false,
      message: "Failed to start the artist socials scrape.",
    });
  });
});
