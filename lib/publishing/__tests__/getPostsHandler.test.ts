import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getPostsHandler } from "../getPostsHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectScheduledPosts } from "@/lib/supabase/scheduled_posts/selectScheduledPosts";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/scheduled_posts/selectScheduledPosts", () => ({
  selectScheduledPosts: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";

describe("getPostsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null, authToken: "t" });
    vi.mocked(selectScheduledPosts).mockResolvedValue([
      { id: "p1", account_id: accountId },
    ] as never);
  });

  it("lists the resolved account's posts with filters and paging", async () => {
    const res = await getPostsHandler(
      new NextRequest(
        "http://localhost/api/posts?status=failed&platform=youtube&limit=5&offset=10",
      ),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).posts).toHaveLength(1);
    expect(selectScheduledPosts).toHaveBeenCalledWith({
      accountId,
      status: "failed",
      platform: "youtube",
      limit: 5,
      offset: 10,
    });
  });

  it("rejects unknown filter values before auth", async () => {
    const res = await getPostsHandler(
      new NextRequest("http://localhost/api/posts?platform=tiktok"),
    );
    expect(res.status).toBe(400);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 500 rather than an empty list when the read fails", async () => {
    vi.mocked(selectScheduledPosts).mockRejectedValue(new Error("db down"));
    const res = await getPostsHandler(new NextRequest("http://localhost/api/posts"));
    expect(res.status).toBe(500);
  });
});
