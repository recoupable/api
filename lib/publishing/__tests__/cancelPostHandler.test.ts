import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { cancelPostHandler } from "../cancelPostHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { selectScheduledPosts } from "@/lib/supabase/scheduled_posts/selectScheduledPosts";
import { updateScheduledPostIfStatus } from "@/lib/supabase/scheduled_posts/updateScheduledPostIfStatus";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("workflow/api", () => ({ getRun: vi.fn() }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("@/lib/supabase/scheduled_posts/selectScheduledPosts", () => ({
  selectScheduledPosts: vi.fn(),
}));
vi.mock("@/lib/supabase/scheduled_posts/updateScheduledPostIfStatus", () => ({
  updateScheduledPostIfStatus: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const postId = "3f1c2b7e-8a4d-4c1e-9b2a-6d5e4f3a2b1c";
const request = () => new NextRequest(`http://localhost/api/posts/${postId}`, { method: "DELETE" });
const row = { id: postId, account_id: accountId, status: "scheduled", workflow_run_id: "wrun_1" };
const cancel = vi.fn();

describe("cancelPostHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null, authToken: "t" });
    vi.mocked(canAccessAccount).mockResolvedValue(true);
    vi.mocked(selectScheduledPosts).mockResolvedValue([row] as never);
    vi.mocked(updateScheduledPostIfStatus).mockResolvedValue({
      ...row,
      status: "cancelled",
    } as never);
    cancel.mockResolvedValue(undefined);
    vi.mocked(getRun).mockReturnValue({ cancel } as never);
  });

  it("cancels a scheduled post and stops its run", async () => {
    const res = await cancelPostHandler(request(), postId);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: postId, status: "cancelled" });
    expect(updateScheduledPostIfStatus).toHaveBeenCalledWith(postId, "scheduled", {
      status: "cancelled",
    });
    expect(getRun).toHaveBeenCalledWith("wrun_1");
    expect(cancel).toHaveBeenCalled();
  });

  it("still answers cancelled when stopping the run fails", async () => {
    cancel.mockRejectedValue(new Error("run already finished"));
    const res = await cancelPostHandler(request(), postId);
    expect(res.status).toBe(200);
  });

  it("returns 400 for a malformed id before auth", async () => {
    const res = await cancelPostHandler(request(), "nope");
    expect(res.status).toBe(400);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns the auth failure as-is", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );
    expect((await cancelPostHandler(request(), postId)).status).toBe(401);
  });

  it("returns 404 for an unknown post", async () => {
    vi.mocked(selectScheduledPosts).mockResolvedValue([] as never);
    expect((await cancelPostHandler(request(), postId)).status).toBe(404);
  });

  it("returns 403 for someone else's post and changes nothing", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(false);
    expect((await cancelPostHandler(request(), postId)).status).toBe(403);
    expect(updateScheduledPostIfStatus).not.toHaveBeenCalled();
  });

  it.each(["publishing", "posted", "failed", "cancelled"])(
    "returns 409 for a %s post and changes nothing",
    async status => {
      vi.mocked(selectScheduledPosts).mockResolvedValue([{ ...row, status }] as never);
      const res = await cancelPostHandler(request(), postId);
      expect(res.status).toBe(409);
      expect(updateScheduledPostIfStatus).not.toHaveBeenCalled();
      expect(getRun).not.toHaveBeenCalled();
    },
  );

  it("returns 409 when the post started publishing in the meantime", async () => {
    vi.mocked(updateScheduledPostIfStatus).mockResolvedValue(null);
    const res = await cancelPostHandler(request(), postId);
    expect(res.status).toBe(409);
    expect(getRun).not.toHaveBeenCalled();
  });

  it("returns 500 when the lookup fails", async () => {
    vi.mocked(selectScheduledPosts).mockRejectedValue(new Error("db down"));
    expect((await cancelPostHandler(request(), postId)).status).toBe(500);
  });
});
