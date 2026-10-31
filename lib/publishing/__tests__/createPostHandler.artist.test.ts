import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createPostHandler } from "../createPostHandler";
import { validateCreatePostBody } from "../validateCreatePostBody";
import { validatePostAccounts } from "../validatePostAccounts";
import { findConnectedAccountId } from "../findConnectedAccountId";
import { ensurePostCredits } from "../ensurePostCredits";
import { startPost } from "../startPost";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("../validateCreatePostBody", () => ({ validateCreatePostBody: vi.fn() }));
vi.mock("../validatePostAccounts", () => ({ validatePostAccounts: vi.fn() }));
vi.mock("../findConnectedAccountId", () => ({ findConnectedAccountId: vi.fn() }));
vi.mock("../ensurePostCredits", () => ({ ensurePostCredits: vi.fn() }));
vi.mock("../startPost", () => ({ startPost: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const artist = "3f1c2b7e-8a4d-4c1e-9b2a-6d5e4f3a2b1c";
const request = () => new NextRequest("http://localhost/api/posts", { method: "POST" });
const body = {
  accountId,
  artist_account_id: artist,
  platform: "x",
  video_url: "https://cdn.example.test/clip.mp4",
  description: "d",
};

describe("createPostHandler artist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCreatePostBody).mockResolvedValue(body as never);
    vi.mocked(validatePostAccounts).mockResolvedValue(null);
    vi.mocked(findConnectedAccountId).mockResolvedValue("ca_123");
    vi.mocked(ensurePostCredits).mockResolvedValue(null);
    vi.mocked(startPost).mockResolvedValue({ id: "p1", status: "publishing" } as never);
  });

  it("posts from the artist's connection and charges the account", async () => {
    const res = await createPostHandler(request());
    expect(res.status).toBe(202);
    expect(findConnectedAccountId).toHaveBeenCalledWith(artist, "x");
    expect(ensurePostCredits).toHaveBeenCalledWith(accountId);
    expect(startPost).toHaveBeenCalledWith(body);
  });

  it("uses the account's own connection when no artist is named", async () => {
    vi.mocked(validateCreatePostBody).mockResolvedValue({
      ...body,
      artist_account_id: undefined,
    } as never);
    await createPostHandler(request());
    expect(findConnectedAccountId).toHaveBeenCalledWith(accountId, "x");
  });

  it("returns the account check's error before any lookup or charge", async () => {
    vi.mocked(validatePostAccounts).mockResolvedValue(
      NextResponse.json({ error: "account_id is an artist" }, { status: 400 }),
    );
    const res = await createPostHandler(request());
    expect(res.status).toBe(400);
    expect(findConnectedAccountId).not.toHaveBeenCalled();
    expect(ensurePostCredits).not.toHaveBeenCalled();
    expect(startPost).not.toHaveBeenCalled();
  });
});
