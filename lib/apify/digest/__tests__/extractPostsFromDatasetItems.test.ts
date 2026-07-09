import { describe, it, expect } from "vitest";
import { extractPostsFromDatasetItems } from "@/lib/apify/digest/extractPostsFromDatasetItems";

const IG_ITEMS = [
  {
    latestPosts: [
      {
        url: "https://instagram.com/p/new1",
        caption: "cap one",
        displayUrl: "https://cdn.ig/new1.jpg",
        timestamp: "2026-07-08T12:00:00.000Z",
      },
      {
        url: "https://instagram.com/p/old",
        caption: "old",
        displayUrl: "https://cdn.ig/old.jpg",
        timestamp: "2026-06-01T00:00:00.000Z",
      },
    ],
  },
];

const TIKTOK_ITEMS = [
  {
    webVideoUrl: "https://tiktok.com/@a/video/1",
    text: "tt caption",
    createTimeISO: "2026-07-09T09:00:00.000Z",
    videoMeta: { coverUrl: "https://cdn.tt/1.jpg" },
  },
  {
    webVideoUrl: "https://tiktok.com/@a/video/2",
    text: "known",
    createTimeISO: "2026-01-01T00:00:00.000Z",
  },
];

describe("extractPostsFromDatasetItems", () => {
  it("maps Instagram latestPosts limited to the new URLs, with media", () => {
    const posts = extractPostsFromDatasetItems("instagram", IG_ITEMS, [
      "https://instagram.com/p/new1",
    ]);
    expect(posts).toEqual([
      {
        url: "https://instagram.com/p/new1",
        caption: "cap one",
        thumbnailUrl: "https://cdn.ig/new1.jpg",
        timestamp: "2026-07-08T12:00:00.000Z",
      },
    ]);
  });

  it("maps TikTok items limited to the new URLs, with cover media", () => {
    const posts = extractPostsFromDatasetItems("tiktok", TIKTOK_ITEMS, [
      "https://tiktok.com/@a/video/1",
    ]);
    expect(posts).toEqual([
      {
        url: "https://tiktok.com/@a/video/1",
        caption: "tt caption",
        thumbnailUrl: "https://cdn.tt/1.jpg",
        timestamp: "2026-07-09T09:00:00.000Z",
      },
    ]);
  });

  it("falls back to URL-only posts for platforms without an extractor", () => {
    const posts = extractPostsFromDatasetItems(
      "youtube",
      [{ some: "shape" }],
      ["https://youtube.com/watch?v=1"],
    );
    expect(posts).toEqual([{ url: "https://youtube.com/watch?v=1" }]);
  });

  it("falls back to URL-only for new URLs missing from the dataset items", () => {
    const posts = extractPostsFromDatasetItems("instagram", IG_ITEMS, [
      "https://instagram.com/p/new1",
      "https://instagram.com/p/not-in-items",
    ]);
    expect(posts).toHaveLength(2);
    expect(posts[1]).toEqual({ url: "https://instagram.com/p/not-in-items" });
  });
});
