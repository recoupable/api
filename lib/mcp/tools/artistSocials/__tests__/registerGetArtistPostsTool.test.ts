import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetArtistPostsTool } from "../registerGetArtistPostsTool";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { selectPosts } from "@/lib/supabase/posts/selectPosts";

vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({ checkAccountArtistAccess: vi.fn() }));
vi.mock("@/lib/supabase/posts/selectPosts", () => ({ selectPosts: vi.fn() }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));

const ARTIST_ID = "660e8400-e29b-41d4-a716-446655440000";
const POST = {
  id: "p1",
  post_url: "https://www.instagram.com/p/abc",
  updated_at: "2026-11-01T00:00:00Z",
  views: 10,
  likes: 2,
  comments: 1,
  reposts: 0,
};
const extra = (accountId?: string) =>
  ({
    authInfo: accountId
      ? { token: "t", clientId: accountId, scopes: [], extra: { accountId, orgId: null } }
      : undefined,
  }) as never;
const text = (result: { content: Array<{ text: string }> }) => JSON.parse(result.content[0].text);

describe("registerGetArtistPostsTool", () => {
  let config: { inputSchema: { safeParse: (v: unknown) => { success: boolean } } };
  let handler: (args: unknown, extra: unknown) => Promise<{ content: Array<{ text: string }> }>;

  beforeEach(() => {
    vi.clearAllMocks();
    const server = {
      registerTool: vi.fn((name, c, h) => {
        expect(name).toBe("get_artist_posts");
        config = c;
        handler = h;
      }),
    } as unknown as McpServer;
    registerGetArtistPostsTool(server);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(selectPosts).mockResolvedValue({ posts: [POST], totalCount: 45 } as never);
  });

  it("validates the artist id and page size", () => {
    expect(config.inputSchema.safeParse({ artist_account_id: "nope" }).success).toBe(false);
    expect(config.inputSchema.safeParse({ artist_account_id: ARTIST_ID, limit: 101 }).success).toBe(
      false,
    );
    expect(config.inputSchema.safeParse({ artist_account_id: ARTIST_ID, page: 2 }).success).toBe(
      true,
    );
  });

  it("applies the REST defaults and returns the same envelope", async () => {
    const result = await handler({ artist_account_id: ARTIST_ID }, extra("acct"));
    expect(checkAccountArtistAccess).toHaveBeenCalledWith("acct", ARTIST_ID);
    expect(selectPosts).toHaveBeenCalledWith({ artistAccountId: ARTIST_ID, page: 1, limit: 20 });
    expect(text(result)).toEqual({
      status: "success",
      posts: [POST],
      pagination: { total_count: 45, page: 1, limit: 20, total_pages: 3 },
    });
  });

  it("passes explicit pagination through", async () => {
    await handler({ artist_account_id: ARTIST_ID, page: 2, limit: 50 }, extra("acct"));
    expect(selectPosts).toHaveBeenCalledWith({ artistAccountId: ARTIST_ID, page: 2, limit: 50 });
  });

  it("requires authentication", async () => {
    const result = await handler({ artist_account_id: ARTIST_ID }, extra());
    expect(text(result).success).toBe(false);
    expect(selectPosts).not.toHaveBeenCalled();
  });

  it("denies artists the caller cannot access", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);
    const result = await handler({ artist_account_id: ARTIST_ID }, extra("acct"));
    expect(text(result).message).toBe("Access denied to specified artist_account_id");
    expect(selectPosts).not.toHaveBeenCalled();
  });

  it("returns a redacted error when the query fails", async () => {
    vi.mocked(selectPosts).mockRejectedValue(new Error("Failed to fetch posts: db"));
    const result = await handler({ artist_account_id: ARTIST_ID }, extra("acct"));
    expect(text(result)).toEqual({ success: false, message: "Failed to list artist posts." });
  });
});
