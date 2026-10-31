import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getPostHandler } from "../getPostHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { selectScheduledPosts } from "@/lib/supabase/scheduled_posts/selectScheduledPosts";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("@/lib/supabase/scheduled_posts/selectScheduledPosts", () => ({
  selectScheduledPosts: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const postId = "3f1c2b7e-8a4d-4c1e-9b2a-6d5e4f3a2b1c";
const request = () => new NextRequest(`http://localhost/api/posts/${postId}`);
const row = {
  id: postId,
  account_id: accountId,
  platform: "youtube",
  status: "posted",
  post_url: "https://www.youtube.com/watch?v=abc",
  text_verified: true,
  workflow_run_id: "wrun_1",
  created_by_account_id: null,
};

describe("getPostHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null, authToken: "t" });
    vi.mocked(canAccessAccount).mockResolvedValue(true);
    vi.mocked(selectScheduledPosts).mockResolvedValue([row] as never);
  });

  it("returns the post without internal handles", async () => {
    const res = await getPostHandler(request(), postId);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.post).toMatchObject({ id: postId, status: "posted", text_verified: true });
    expect(body.post).not.toHaveProperty("workflow_run_id");
    expect(body.post).not.toHaveProperty("created_by_account_id");
  });

  it("returns 400 for a malformed id without auth", async () => {
    const res = await getPostHandler(request(), "nope");
    expect(res.status).toBe(400);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 404 when missing and 403 without access", async () => {
    vi.mocked(selectScheduledPosts).mockResolvedValueOnce([]);
    expect((await getPostHandler(request(), postId)).status).toBe(404);
    vi.mocked(canAccessAccount).mockResolvedValueOnce(false);
    expect((await getPostHandler(request(), postId)).status).toBe(403);
  });
});
