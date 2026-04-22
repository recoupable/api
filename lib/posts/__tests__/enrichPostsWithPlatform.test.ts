import { describe, it, expect } from "vitest";
import { enrichPostsWithPlatform } from "../enrichPostsWithPlatform";
import type { Tables } from "@/types/database.types";

const post = (id: string): Tables<"posts"> =>
  ({
    id,
    post_url: `https://example.com/${id}`,
    updated_at: "2024-01-01",
  }) as Tables<"posts">;

const social = (id: string, profile_url: string): Tables<"socials"> =>
  ({ id, profile_url }) as Tables<"socials">;

describe("enrichPostsWithPlatform", () => {
  it("returns [] for empty posts", () => {
    expect(enrichPostsWithPlatform([], [], [])).toEqual([]);
  });

  it.each([
    ["https://instagram.com/u", "INSTAGRAM"],
    ["https://www.tiktok.com/@u", "TIKTOK"],
    ["https://twitter.com/u", "TWITTER"],
    ["https://x.com/u", "TWITTER"],
    ["https://open.spotify.com/artist/x", "SPOTIFY"],
    ["https://example.com/u", "UNKNOWN"],
  ])("maps %s → %s", (profileUrl, expected) => {
    const p = post("p1");
    const s = social("s1", profileUrl);
    const sp = [{ post_id: "p1", social_id: "s1" }];
    const out = enrichPostsWithPlatform([p], sp, [s]);
    expect(out[0].platform).toBe(expected);
    expect(out[0].id).toBe("p1");
  });

  it("falls back to UNKNOWN when no matching social is found", () => {
    const p = post("p1");
    const out = enrichPostsWithPlatform([p], [], []);
    expect(out[0].platform).toBe("UNKNOWN");
  });
});
