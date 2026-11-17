import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetPublishedPostStatsTool } from "../registerGetPublishedPostStatsTool";
import { getPostStats } from "@/lib/publishing/stats/getPostStats";

vi.mock("@/lib/publishing/stats/getPostStats", () => ({ getPostStats: vi.fn() }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));

const POST_ID = "3f1c2b7e-8a4d-4c1e-9b2a-6d5e4f3a2b1c";
const STATS = { post_id: POST_ID, platform: "linkedin", impressions: 900 };
const extra = (accountId?: string) =>
  ({
    authInfo: accountId
      ? { token: "t", clientId: accountId, scopes: [], extra: { accountId, orgId: null } }
      : undefined,
  }) as never;
const text = (result: { content: Array<{ text: string }> }) => JSON.parse(result.content[0].text);

describe("registerGetPublishedPostStatsTool", () => {
  let config: {
    description: string;
    inputSchema: { safeParse: (v: unknown) => { success: boolean }; shape: object };
  };
  let handler: (args: unknown, extra: unknown) => Promise<{ content: Array<{ text: string }> }>;

  beforeEach(() => {
    vi.clearAllMocks();
    const server = {
      registerTool: vi.fn((name, c, h) => {
        expect(name).toBe("get_published_post_stats");
        config = c;
        handler = h;
      }),
    } as unknown as McpServer;
    registerGetPublishedPostStatsTool(server);
    vi.mocked(getPostStats).mockResolvedValue({ kind: "ok", stats: STATS } as never);
  });

  it("keeps the description to three sentences and states the cost and the LinkedIn limit", () => {
    const sentences = config.description.split(/(?<=[.!?])\s+/).filter(Boolean);
    expect(sentences.length).toBeLessThanOrEqual(3);
    expect(config.description).toContain("$0.001");
    expect(config.description).toContain("LinkedIn company-page");
  });

  it("takes only a uuid id", () => {
    expect(config.inputSchema.shape).not.toHaveProperty("account_id");
    expect(config.inputSchema.safeParse({ id: POST_ID }).success).toBe(true);
    expect(config.inputSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
    expect(config.inputSchema.safeParse({}).success).toBe(false);
  });

  it("reads the stats for the caller and returns the REST envelope", async () => {
    const result = await handler({ id: POST_ID }, extra("acct"));
    expect(getPostStats).toHaveBeenCalledWith({ accountId: "acct", postId: POST_ID });
    expect(text(result)).toEqual({ status: "success", stats: STATS });
  });

  it("returns a rejection's REST message as a tool error", async () => {
    vi.mocked(getPostStats).mockResolvedValue({
      kind: "rejected",
      status: 422,
      message: "Stats are not available for youtube posts yet",
    });
    expect(text(await handler({ id: POST_ID }, extra("acct")))).toEqual({
      success: false,
      message: "Stats are not available for youtube posts yet",
    });
  });

  it("reports a credit shortfall", async () => {
    vi.mocked(getPostStats).mockResolvedValue({
      kind: "insufficient_credits",
      remainingCredits: 10,
      requiredCredits: 1000,
    });
    expect(text(await handler({ id: POST_ID }, extra("acct")))).toEqual({
      success: false,
      message: "Insufficient credits: 10 remaining, 1000 required",
    });
  });

  it("requires authentication", async () => {
    const result = await handler({ id: POST_ID }, extra());
    expect(text(result).success).toBe(false);
    expect(getPostStats).not.toHaveBeenCalled();
  });

  it("returns a generic tool error when the read throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getPostStats).mockRejectedValue(new Error("db down"));
    expect(text(await handler({ id: POST_ID }, extra("acct")))).toEqual({
      success: false,
      message: "Failed to read post stats.",
    });
    spy.mockRestore();
  });
});
