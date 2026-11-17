import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetPublishedPostsTool } from "../registerGetPublishedPostsTool";
import { getPosts } from "@/lib/publishing/getPosts";

vi.mock("@/lib/publishing/getPosts", () => ({ getPosts: vi.fn() }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));

const ARTIST_ID = "660e8400-e29b-41d4-a716-446655440000";
const POST = { id: "3f1c2b7e-8a4d-4c1e-9b2a-6d5e4f3a2b1c", platform: "linkedin" };
const extra = (accountId?: string) =>
  ({
    authInfo: accountId
      ? { token: "t", clientId: accountId, scopes: [], extra: { accountId, orgId: null } }
      : undefined,
  }) as never;
const text = (result: { content: Array<{ text: string }> }) => JSON.parse(result.content[0].text);

describe("registerGetPublishedPostsTool", () => {
  let config: {
    description: string;
    inputSchema: { safeParse: (v: unknown) => { success: boolean }; shape: object };
  };
  let handler: (args: unknown, extra: unknown) => Promise<{ content: Array<{ text: string }> }>;

  beforeEach(() => {
    vi.clearAllMocks();
    const server = {
      registerTool: vi.fn((name, c, h) => {
        expect(name).toBe("get_published_posts");
        config = c;
        handler = h;
      }),
    } as unknown as McpServer;
    registerGetPublishedPostsTool(server);
    vi.mocked(getPosts).mockResolvedValue([POST] as never);
  });

  it("says it is free, separates itself from scraped posts and points at the stats tool", () => {
    expect(config.description).toContain("get_published_post_stats");
    expect(config.description).toContain("get_artist_posts");
    expect(config.description).not.toContain("$");
  });

  it("takes no account_id and reuses the REST limits", () => {
    expect(config.inputSchema.shape).not.toHaveProperty("account_id");
    expect(config.inputSchema.safeParse({}).success).toBe(true);
    expect(config.inputSchema.safeParse({ platform: "linkedin", limit: 50 }).success).toBe(true);
    expect(config.inputSchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(config.inputSchema.safeParse({ platform: "myspace" }).success).toBe(false);
    expect(config.inputSchema.safeParse({ status: "lost" }).success).toBe(false);
    expect(config.inputSchema.safeParse({ artist_account_id: "nope" }).success).toBe(false);
  });

  it("lists the caller's posts with REST defaults and the REST envelope", async () => {
    const result = await handler({}, extra("acct"));
    expect(getPosts).toHaveBeenCalledWith({
      accountId: "acct",
      artistAccountId: undefined,
      status: undefined,
      platform: undefined,
      limit: 20,
      offset: 0,
    });
    expect(text(result)).toEqual({ status: "success", posts: [POST] });
  });

  it("passes every filter through", async () => {
    await handler(
      {
        artist_account_id: ARTIST_ID,
        status: "posted",
        platform: "linkedin",
        limit: 7,
        offset: 14,
      },
      extra("acct"),
    );
    expect(getPosts).toHaveBeenCalledWith({
      accountId: "acct",
      artistAccountId: ARTIST_ID,
      status: "posted",
      platform: "linkedin",
      limit: 7,
      offset: 14,
    });
  });

  it("requires authentication", async () => {
    const result = await handler({}, extra());
    expect(text(result).success).toBe(false);
    expect(getPosts).not.toHaveBeenCalled();
  });

  it("returns a tool error when the read fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getPosts).mockRejectedValue(new Error("db down"));
    expect(text(await handler({}, extra("acct")))).toEqual({
      success: false,
      message: "Failed to list published posts.",
    });
    spy.mockRestore();
  });
});
