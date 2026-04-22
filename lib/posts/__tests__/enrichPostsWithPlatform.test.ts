import { describe, it, expect } from "vitest";
import { enrichPostsWithPlatform } from "../enrichPostsWithPlatform";

const post = (id: string) => ({ id, post_url: `https://x/${id}`, updated_at: "2024-01-01" });
const sp = (post_id: string, social_id: string) => ({ post_id, social_id });
const social = (id: string, profile_url: string) => ({ id, profile_url });

describe("enrichPostsWithPlatform", () => {
  it("returns empty array when no posts", () => {
    expect(enrichPostsWithPlatform([], [], [])).toEqual([]);
  });

  it.each([
    ["https://instagram.com/abc", "INSTAGRAM"],
    ["https://www.tiktok.com/@x", "TIKTOK"],
    ["https://twitter.com/x", "TWITTER"],
    ["https://x.com/abc", "TWITTER"],
    ["https://open.spotify.com/artist/1", "SPOTIFY"],
    ["https://youtube.com/x", "UNKNOWN"],
  ])("derives platform from profile_url %s → %s", (url, expected) => {
    const result = enrichPostsWithPlatform([post("p1")], [sp("p1", "s1")], [social("s1", url)]);
    expect(result[0].platform).toBe(expected);
  });

  it("marks posts with no matching social link as UNKNOWN", () => {
    const result = enrichPostsWithPlatform([post("orphan")], [], []);
    expect(result[0].platform).toBe("UNKNOWN");
  });

  it("preserves original post fields alongside platform", () => {
    const [enriched] = enrichPostsWithPlatform(
      [{ id: "p1", post_url: "url", updated_at: "t" }],
      [sp("p1", "s1")],
      [social("s1", "https://instagram.com/x")],
    );
    expect(enriched).toEqual({
      id: "p1",
      post_url: "url",
      updated_at: "t",
      platform: "INSTAGRAM",
    });
  });
});
