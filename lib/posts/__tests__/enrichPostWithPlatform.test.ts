import { describe, it, expect } from "vitest";
import { enrichPostWithPlatform } from "../enrichPostWithPlatform";

const postWith = (profile_url: string | null) => ({
  id: "p1",
  post_url: "url",
  updated_at: "t",
  social_posts: profile_url === null ? [] : [{ social: { profile_url } }],
});

describe("enrichPostWithPlatform", () => {
  it.each([
    ["https://instagram.com/abc", "INSTAGRAM"],
    ["https://www.tiktok.com/@x", "TIKTOK"],
    ["https://twitter.com/x", "TWITTER"],
    ["https://x.com/abc", "TWITTER"],
    ["https://open.spotify.com/artist/1", "SPOTIFY"],
    ["https://youtube.com/x", "UNKNOWN"],
  ])("derives platform from profile_url %s → %s", (url, expected) => {
    expect(enrichPostWithPlatform(postWith(url)).platform).toBe(expected);
  });

  it("marks posts with no social linkage as UNKNOWN", () => {
    expect(enrichPostWithPlatform(postWith(null)).platform).toBe("UNKNOWN");
  });

  it("preserves original post fields alongside platform", () => {
    expect(enrichPostWithPlatform(postWith("https://instagram.com/x"))).toMatchObject({
      id: "p1",
      post_url: "url",
      updated_at: "t",
      platform: "INSTAGRAM",
    });
  });
});
