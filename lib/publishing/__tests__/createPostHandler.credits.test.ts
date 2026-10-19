import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createPostHandler } from "../createPostHandler";
import { validateCreatePostBody } from "../validateCreatePostBody";
import { findConnectedAccountId } from "../findConnectedAccountId";
import { ensurePostCredits } from "../ensurePostCredits";
import { startPost } from "../startPost";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("../validateCreatePostBody", () => ({ validateCreatePostBody: vi.fn() }));
vi.mock("../findConnectedAccountId", () => ({ findConnectedAccountId: vi.fn() }));
vi.mock("../ensurePostCredits", () => ({ ensurePostCredits: vi.fn() }));
vi.mock("../startPost", () => ({ startPost: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const request = () => new NextRequest("http://localhost/api/posts", { method: "POST" });

describe("createPostHandler credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCreatePostBody).mockResolvedValue({
      accountId,
      platform: "x",
      video_url: "https://cdn.example.test/clip.mp4",
      description: "d",
    } as never);
    vi.mocked(findConnectedAccountId).mockResolvedValue("ca_123");
    vi.mocked(startPost).mockResolvedValue({ id: "p1", status: "publishing" } as never);
  });

  it("returns the 402 and creates no post when the account is short", async () => {
    const short = NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
    vi.mocked(ensurePostCredits).mockResolvedValue(short);
    const res = await createPostHandler(request());
    expect(res.status).toBe(402);
    expect(ensurePostCredits).toHaveBeenCalledWith(accountId);
    expect(startPost).not.toHaveBeenCalled();
  });

  it("starts the post when the account has credits", async () => {
    vi.mocked(ensurePostCredits).mockResolvedValue(null);
    const res = await createPostHandler(request());
    expect(res.status).toBe(202);
    expect(startPost).toHaveBeenCalled();
  });
});
