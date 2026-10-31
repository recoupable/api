import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreatePostBody } from "../validateCreatePostBody";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const video = "https://cdn.example.test/clip.mp4";

const request = (body: unknown) =>
  new NextRequest("http://localhost/api/posts", { method: "POST", body: JSON.stringify(body) });

async function expect400(body: unknown, field: string) {
  const res = (await validateCreatePostBody(request(body))) as NextResponse;
  expect(res.status).toBe(400);
  const json = await res.json();
  expect(json.status).toBe("error");
  expect(json.missing_fields).toContain(field);
  return json;
}

describe("validateCreatePostBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null, authToken: "t" });
  });

  it("accepts a post per platform and resolves the account", async () => {
    const bodies = [
      {
        platform: "instagram",
        video_url: video,
        description: "caption",
        cover_url: "https://cdn.example.test/c.jpg",
      },
      { platform: "x", video_url: video, description: "post text" },
      {
        platform: "linkedin",
        video_url: video,
        description: "commentary",
        title: "t",
        sub_account_id: "urn:li:organization:1",
      },
      { platform: "youtube", video_url: video, title: "Title", privacy: "public", tags: ["music"] },
    ];
    for (const body of bodies) {
      const result = await validateCreatePostBody(request(body));
      expect(result).toMatchObject({ accountId, ...body });
    }
  });

  it("passes account_id to auth as an override", async () => {
    const other = "3f1c2b7e-8a4d-4c1e-9b2a-6d5e4f3a2b1c";
    await validateCreatePostBody(
      request({ platform: "x", video_url: video, description: "d", account_id: other }),
    );
    expect(validateAuthContext).toHaveBeenCalledWith(expect.anything(), { accountId: other });
  });

  it("requires the platform's copy", async () => {
    await expect400({ platform: "youtube", video_url: video }, "title");
    await expect400({ platform: "instagram", video_url: video }, "description");
    await expect400({ platform: "x", video_url: video, description: "   " }, "description");
  });

  it("enforces the published limits", async () => {
    await expect400({ platform: "youtube", video_url: video, title: "t".repeat(101) }, "title");
    await expect400(
      { platform: "instagram", video_url: video, description: "c".repeat(2201) },
      "description",
    );
    await expect400(
      { platform: "linkedin", video_url: video, description: "c".repeat(3001) },
      "description",
    );
    const json = await expect400(
      { platform: "x", video_url: video, description: "音".repeat(141) },
      "description",
    );
    expect(json.error).toContain("280 weighted characters");
  });

  it("rejects fields the platform does not use", async () => {
    await expect400(
      { platform: "x", video_url: video, description: "d", privacy: "public" },
      "privacy",
    );
    await expect400(
      {
        platform: "instagram",
        video_url: video,
        description: "d",
        sub_account_id: "urn:li:organization:1",
      },
      "sub_account_id",
    );
    await expect400(
      {
        platform: "youtube",
        video_url: video,
        title: "t",
        cover_url: "https://cdn.example.test/c.jpg",
      },
      "cover_url",
    );
  });

  it("rejects unknown fields, bad URLs and unknown platforms", async () => {
    await expect400(
      { platform: "x", video_url: video, description: "d", organization_id: "x" },
      "organization_id",
    );
    await expect400({ platform: "x", video_url: "not a url", description: "d" }, "video_url");
    await expect400({ platform: "tiktok", video_url: video, description: "d" }, "platform");
  });

  it("returns the auth failure as-is", async () => {
    const denied = NextResponse.json({ status: "error" }, { status: 403 });
    vi.mocked(validateAuthContext).mockResolvedValue(denied);
    const res = await validateCreatePostBody(
      request({ platform: "x", video_url: video, description: "d" }),
    );
    expect(res).toBe(denied);
  });
});
