import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreatePostBody } from "../validateCreatePostBody";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const base = { platform: "x", video_url: "https://cdn.example.test/clip.mp4", description: "d" };
const request = (body: unknown) =>
  new NextRequest("http://localhost/api/posts", { method: "POST", body: JSON.stringify(body) });
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

describe("validateCreatePostBody scheduling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null, authToken: "t" });
  });

  it("accepts a future publish_at, with Z or an offset", async () => {
    const z = inHours(2);
    expect(await validateCreatePostBody(request({ ...base, publish_at: z }))).toMatchObject({
      accountId,
      publish_at: z,
    });
    const offset = "2099-01-01T09:00:00-05:00";
    expect(await validateCreatePostBody(request({ ...base, publish_at: offset }))).toMatchObject({
      publish_at: offset,
    });
  });

  it.each([
    ["in the past", () => inHours(-1)],
    ["without a timezone", () => "2099-01-01T09:00:00"],
    ["not a date", () => "tomorrow"],
  ])("rejects a publish_at %s, before auth", async (_label, value) => {
    const res = (await validateCreatePostBody(
      request({ ...base, publish_at: value() }),
    )) as NextResponse;
    expect(res.status).toBe(400);
    expect((await res.json()).missing_fields).toContain("publish_at");
    expect(validateAuthContext).not.toHaveBeenCalled();
  });
});
