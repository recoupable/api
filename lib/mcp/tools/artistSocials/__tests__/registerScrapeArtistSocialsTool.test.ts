import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerScrapeArtistSocialsTool } from "../registerScrapeArtistSocialsTool";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { checkCreditsAvailable } from "@/lib/credits/checkCreditsAvailable";
import { startArtistSocialsScrape } from "@/lib/artist/startArtistSocialsScrape";

const redis = vi.hoisted(() => ({
  values: new Map<string, { value: string; until: number }>(),
  eval: vi.fn(),
}));

vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({ checkAccountArtistAccess: vi.fn() }));
vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: vi.fn(),
}));
vi.mock("@/lib/credits/checkCreditsAvailable", () => ({ checkCreditsAvailable: vi.fn() }));
vi.mock("@/lib/artist/startArtistSocialsScrape", () => ({ startArtistSocialsScrape: vi.fn() }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("ioredis", () => ({
  Redis: class {
    eval = redis.eval;
    on() {}
    async connect() {}
    disconnect() {}
    async set(key: string, value: string, _ex: string, ttl: number) {
      redis.values.set(key, { value, until: Date.now() + ttl * 1000 });
      return "OK";
    }
  },
}));

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
  let config: {
    description: string;
    inputSchema: { safeParse: (v: unknown) => { success: boolean } };
  };
  let handler: (args: unknown, extra: unknown) => Promise<{ content: Array<{ text: string }> }>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("OAUTH_INDEX_KEY", undefined);
    vi.stubEnv("REDIS_URL", "redis://fixture.invalid:6379");
    redis.values.clear();
    redis.eval.mockImplementation(async (_script, keys, quoteKey, lockKey, scope, token) => {
      const entry = redis.values.get(quoteKey);
      if (keys === 1) {
        if (entry?.value === lockKey) redis.values.delete(quoteKey);
        return 1;
      }
      if (!entry || entry.until <= Date.now() || entry.value !== scope) return 0;
      if (redis.values.has(lockKey)) return 1;
      redis.values.set(lockKey, { value: token, until: Infinity });
      redis.values.delete(quoteKey);
      return 2;
    });
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

  it("describes the credit quote and approval before starting a refresh", () => {
    expect(config.description).toBe(
      "Refresh public social profiles and recent posts for an artist you can access. Recoup shows the maximum credit cost before starting and uses existing credits only after you approve.",
    );
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

  async function quote(posts?: number) {
    const args = { artist_account_id: ARTIST_ID, posts };
    const result = await handler(args, extra("acct"));
    return { ...args, approved_quote: text(result).quote as string };
  }

  it("checks the approved maximum and dispatches with the existing per-profile price", async () => {
    const result = await handler(await quote(5), extra("acct"));
    expect(checkAccountArtistAccess).toHaveBeenCalledWith("acct", ARTIST_ID);
    // (50,000 + 5 × 10,000) × 2 profiles
    expect(checkCreditsAvailable).toHaveBeenCalledWith({
      accountId: "acct",
      creditsToDeduct: 200_000,
    });
    expect(redis.eval).toHaveBeenCalledTimes(2);
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

  it("quotes the maximum without starting work or charging credits", async () => {
    const result = await handler({ artist_account_id: ARTIST_ID, posts: 5 }, extra("acct"));
    expect(text(result)).toMatchObject({
      approval_required: true,
      profile_count: 2,
      maximum_credits: 200_000,
      maximum_usd: 0.2,
    });
    expect(startArtistSocialsScrape).not.toHaveBeenCalled();
    expect(checkCreditsAvailable).not.toHaveBeenCalled();
  });

  it("rejects a quote used with different targets, post depth or billing account", async () => {
    const approved = await quote(5);
    await handler({ ...approved, posts: 6 }, extra("acct"));
    await handler(approved, extra("different"));
    vi.mocked(selectAccountSocials).mockResolvedValue([
      SOCIALS[0],
      { social: { ...SOCIALS[1].social, username: "different" } },
    ] as never);
    const result = await handler(approved, extra("acct"));
    expect(text(result).success).toBe(false);
    expect(checkCreditsAvailable).not.toHaveBeenCalled();
    expect(startArtistSocialsScrape).not.toHaveBeenCalled();
  });

  it("rejects a replay without starting another provider job", async () => {
    const approved = await quote(5);
    await Promise.all([handler(approved, extra("acct")), handler(approved, extra("acct"))]);
    expect(startArtistSocialsScrape).toHaveBeenCalledOnce();
  });

  it("serializes separate quotes through the balance check and dispatch", async () => {
    const first = await quote(5);
    const second = await quote(5);
    let finish!: (runs: Awaited<ReturnType<typeof startArtistSocialsScrape>>) => void;
    let markStarted!: () => void;
    const started = new Promise<void>(resolve => {
      markStarted = resolve;
    });
    vi.mocked(startArtistSocialsScrape).mockImplementationOnce(() => {
      markStarted();
      return new Promise(resolve => {
        finish = resolve;
      });
    });
    const pending = handler(first, extra("acct"));
    await started;
    const busy = await handler(second, extra("acct"));
    expect(text(busy).message).toContain("being started");
    expect(checkCreditsAvailable).toHaveBeenCalledOnce();
    finish([{ runId: "r1", datasetId: null, error: null }]);
    await pending;
    const next = await handler(second, extra("acct"));
    expect(text(next).success).toBe(true);
    expect(checkCreditsAvailable).toHaveBeenCalledTimes(2);
  });

  it("expires an unused quote before spending credits", async () => {
    const approved = await quote(5);
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 11 * 60 * 1000);
    try {
      const result = await handler(approved, extra("acct"));
      expect(text(result).success).toBe(false);
      expect(checkCreditsAvailable).not.toHaveBeenCalled();
      expect(startArtistSocialsScrape).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
    }
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
    const result = await handler(await quote(), extra("acct"));
    expect(text(result).message).toBe("Insufficient credits: 10 remaining, 100000 required");
    expect(startArtistSocialsScrape).not.toHaveBeenCalled();
  });

  it("returns a tool error with each failure when no run started", async () => {
    vi.mocked(startArtistSocialsScrape).mockResolvedValue([
      { runId: null, datasetId: null, error: "Failed to start scrape" },
      { runId: null, datasetId: null, error: "Unsupported platform" },
    ]);
    const result = await handler(await quote(), extra("acct"));
    expect(text(result)).toEqual({
      success: false,
      message:
        "No scrape runs started: Failed to start scrape; Unsupported platform. No credits were charged.",
    });
  });

  it("returns a redacted error when the scrape throws", async () => {
    vi.mocked(startArtistSocialsScrape).mockRejectedValue(new Error("apify token bad"));
    const result = await handler(await quote(), extra("acct"));
    expect(text(result)).toEqual({
      success: false,
      message: "Failed to start the artist socials scrape.",
    });
  });
});
