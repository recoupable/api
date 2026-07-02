import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

import { validateArtistSocialsScrapeBody } from "../validateArtistSocialsScrapeBody";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const ARTIST_ID = "660e8400-e29b-41d4-a716-446655440000";

describe("validateArtistSocialsScrapeBody", () => {
  it("returns 400 when artist_account_id is missing", () => {
    const res = validateArtistSocialsScrapeBody({}) as NextResponse;
    expect(res.status).toBe(400);
  });

  it("accepts a body without posts (legacy behavior)", () => {
    expect(validateArtistSocialsScrapeBody({ artist_account_id: ARTIST_ID })).toEqual({
      artist_account_id: ARTIST_ID,
    });
  });

  it("accepts a valid posts field", () => {
    expect(validateArtistSocialsScrapeBody({ artist_account_id: ARTIST_ID, posts: 20 })).toEqual({
      artist_account_id: ARTIST_ID,
      posts: 20,
    });
  });

  it.each([[0], [101], [1.5], ["20"]])("returns 400 for invalid posts %s", posts => {
    const res = validateArtistSocialsScrapeBody({
      artist_account_id: ARTIST_ID,
      posts,
    }) as NextResponse;
    expect(res.status).toBe(400);
  });
});
