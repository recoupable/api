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
        likesCount: 100,
        commentsCount: 5,
        videoViewCount: 9000,
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
    diggCount: 200,
    commentCount: 10,
    playCount: 50000,
    shareCount: 7,
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
        stats: { likes: 100, comments: 5, views: 9000 },
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
        stats: { likes: 200, comments: 10, views: 50000, shares: 7 },
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

const TWEET_ITEMS = [
  {
    url: "https://x.com/a/status/1",
    fullText: "New single out on all platforms",
    createdAt: "Wed Jul 08 19:43:50 +0000 2026",
    likeCount: 5,
    replyCount: 1,
    retweetCount: 2,
    viewCount: 748,
    extendedEntities: { media: [{ media_url_https: "https://pbs.twimg.com/media/x.jpg" }] },
  },
];

describe("extractPostsFromDatasetItems — twitter", () => {
  it("maps tweets limited to the new URLs, with media and stats", () => {
    const posts = extractPostsFromDatasetItems("twitter", TWEET_ITEMS, [
      "https://x.com/a/status/1",
    ]);
    expect(posts).toEqual([
      {
        url: "https://x.com/a/status/1",
        caption: "New single out on all platforms",
        thumbnailUrl: "https://pbs.twimg.com/media/x.jpg",
        timestamp: "2026-07-08T19:43:50.000Z",
        stats: { likes: 5, comments: 1, views: 748, shares: 2 },
      },
    ]);
  });

  it("maps the x platform alias identically", () => {
    const posts = extractPostsFromDatasetItems("x", TWEET_ITEMS, ["https://x.com/a/status/1"]);
    expect(posts[0].caption).toBe("New single out on all platforms");
  });
});
