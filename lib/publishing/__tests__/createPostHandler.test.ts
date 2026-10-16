import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createPostHandler } from "../createPostHandler";
import { validateCreatePostBody } from "../validateCreatePostBody";
import { findConnectedAccountId } from "../findConnectedAccountId";
import { startPost } from "../startPost";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("../validateCreatePostBody", () => ({ validateCreatePostBody: vi.fn() }));
vi.mock("../findConnectedAccountId", () => ({ findConnectedAccountId: vi.fn() }));
vi.mock("../startPost", () => ({ startPost: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const postId = "3f1c2b7e-8a4d-4c1e-9b2a-6d5e4f3a2b1c";
const request = () => new NextRequest("http://localhost/api/posts", { method: "POST" });
const validated = {
  accountId,
  platform: "x",
  video_url: "https://cdn.example.test/clip.mp4",
  description: "d",
};

describe("createPostHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCreatePostBody).mockResolvedValue(validated as never);
    vi.mocked(findConnectedAccountId).mockResolvedValue("ca_123");
    vi.mocked(startPost).mockResolvedValue({ id: postId, status: "publishing" } as never);
  });

  it("returns 202 { id, status } with a Location header", async () => {
    const res = await createPostHandler(request());
    expect(res.status).toBe(202);
    expect(res.headers.get("Location")).toBe(`/api/posts/${postId}`);
    expect(await res.json()).toEqual({ id: postId, status: "publishing" });
    expect(findConnectedAccountId).toHaveBeenCalledWith(accountId, "x");
  });

  it("returns 409 and starts nothing when the platform is not connected", async () => {
    vi.mocked(findConnectedAccountId).mockResolvedValue(null);
    const res = await createPostHandler(request());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("x is not connected");
    expect(startPost).not.toHaveBeenCalled();
  });

  it("returns the validation failure as-is", async () => {
    const bad = NextResponse.json({ status: "error" }, { status: 400 });
    vi.mocked(validateCreatePostBody).mockResolvedValue(bad);
    const res = await createPostHandler(request());
    expect(res.status).toBe(400);
    expect(findConnectedAccountId).not.toHaveBeenCalled();
  });

  it("returns 500 when starting fails", async () => {
    vi.mocked(startPost).mockRejectedValue(new Error("db down"));
    const res = await createPostHandler(request());
    expect(res.status).toBe(500);
  });
});
