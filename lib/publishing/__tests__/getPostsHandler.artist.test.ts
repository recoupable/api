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
const artist = "3f1c2b7e-8a4d-4c1e-9b2a-6d5e4f3a2b1c";

describe("getPostsHandler artist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null, authToken: "t" });
    vi.mocked(selectScheduledPosts).mockResolvedValue([
      { id: "p1", account_id: accountId, artist_account_id: artist },
    ] as never);
  });

  it("filters the account's posts by artist and returns the artist on each post", async () => {
    const res = await getPostsHandler(
      new NextRequest(`http://localhost/api/posts?artist_account_id=${artist}`),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).posts[0].artist_account_id).toBe(artist);
    expect(selectScheduledPosts).toHaveBeenCalledWith(
      expect.objectContaining({ accountId, artistAccountId: artist }),
    );
  });

  it("rejects an artist filter that is not a uuid", async () => {
    const res = await getPostsHandler(
      new NextRequest("http://localhost/api/posts?artist_account_id=x"),
    );
    expect(res.status).toBe(400);
  });
});
