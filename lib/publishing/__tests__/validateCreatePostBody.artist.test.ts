import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreatePostBody } from "../validateCreatePostBody";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const artist = "3f1c2b7e-8a4d-4c1e-9b2a-6d5e4f3a2b1c";
const request = (body: unknown) =>
  new NextRequest("http://localhost/api/posts", { method: "POST", body: JSON.stringify(body) });
const post = { platform: "x", video_url: "https://cdn.example.test/clip.mp4", description: "d" };

describe("validateCreatePostBody artist_account_id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null, authToken: "t" });
  });

  it("accepts an artist and keeps it apart from the account", async () => {
    const result = await validateCreatePostBody(request({ ...post, artist_account_id: artist }));
    expect(result).toMatchObject({ accountId, artist_account_id: artist });
    expect(validateAuthContext).toHaveBeenCalledWith(expect.anything(), { accountId: undefined });
  });

  it("rejects an artist id that is not a uuid", async () => {
    const res = (await validateCreatePostBody(
      request({ ...post, artist_account_id: "nope" }),
    )) as NextResponse;
    expect(res.status).toBe(400);
    expect((await res.json()).missing_fields).toContain("artist_account_id");
  });
});
