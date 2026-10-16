import { describe, it, expect } from "vitest";
import { mapInstagramPostMedia } from "../mapInstagramPostMedia";
import type { ApifyInstagramPost } from "@/lib/apify/types";

// Shapes trimmed from the Instagram profile actor's latestPosts items; URLs
// and handles are synthetic.
const child = (
  n: number,
  type: "Image" | "Video",
  extra: Partial<ApifyInstagramPost> = {},
): Partial<ApifyInstagramPost> => ({
  id: `c${n}`,
  type,
  displayUrl: `https://cdn.example/carousel-${n}.jpg`,
  dimensionsWidth: 1080,
  dimensionsHeight: 1350,
  ...extra,
});

describe("mapInstagramPostMedia", () => {
  it("retains a single image post's caption verbatim, publish date and display image", () => {
    const result = mapInstagramPostMedia({
      type: "Image",
      caption: "studio week two with @collab_handle #newera",
      timestamp: "2026-08-20T00:00:00.000Z",
      displayUrl: "https://cdn.example/single.jpg",
      images: ["https://cdn.example/single.jpg"],
      dimensionsWidth: 1080,
      dimensionsHeight: 1080,
      alt: "Photo by someone",
    });
    expect(result).toEqual({
      caption: "studio week two with @collab_handle #newera",
      published_at: "2026-08-20T00:00:00.000Z",
      media: [
        {
          position: 0,
          kind: "image",
          provider_url: "https://cdn.example/single.jpg",
          width: 1080,
          height: 1080,
          alt: "Photo by someone",
          source: "apify_instagram",
        },
      ],
    });
  });

  it("keeps carousel children in order with their own kinds and dedupes the cover against them", () => {
    const result = mapInstagramPostMedia({
      type: "Sidecar",
      caption: "tour recap",
      timestamp: "2026-09-01T12:00:00.000Z",
      displayUrl: "https://cdn.example/carousel-0.jpg",
      images: [
        "https://cdn.example/carousel-0.jpg",
        "https://cdn.example/carousel-1.jpg",
        "https://cdn.example/carousel-2.jpg",
      ],
      childPosts: [
        child(0, "Image", { alt: "first slide" }),
        child(1, "Video", { dimensionsWidth: 720, dimensionsHeight: 1280 }),
        child(2, "Image"),
      ] as ApifyInstagramPost[],
    });
    expect(result.media).toEqual([
      {
        position: 0,
        kind: "image",
        provider_url: "https://cdn.example/carousel-0.jpg",
        width: 1080,
        height: 1350,
        alt: "first slide",
        source: "apify_instagram",
      },
      {
        position: 1,
        kind: "video",
        provider_url: "https://cdn.example/carousel-1.jpg",
        width: 720,
        height: 1280,
        alt: null,
        source: "apify_instagram",
      },
      {
        position: 2,
        kind: "image",
        provider_url: "https://cdn.example/carousel-2.jpg",
        width: 1080,
        height: 1350,
        alt: null,
        source: "apify_instagram",
      },
    ]);
  });

  it("leaves missing caption, timestamp and media as null/empty instead of inventing them", () => {
    expect(mapInstagramPostMedia({ url: "https://www.instagram.com/p/bare" })).toEqual({
      caption: null,
      published_at: null,
      media: [],
    });
    expect(mapInstagramPostMedia({ timestamp: "not a date", images: [] }).published_at).toBeNull();
  });

  it("keeps an empty caption distinct from a missing one", () => {
    expect(mapInstagramPostMedia({ caption: "" }).caption).toBe("");
    expect(mapInstagramPostMedia({}).caption).toBeNull();
  });

  it("marks unknown post types, drops non-string URLs and non-finite dimensions", () => {
    const result = mapInstagramPostMedia({
      type: "Reel",
      displayUrl: "https://cdn.example/reel-cover.jpg",
      images: ["", 42 as unknown as string, "https://cdn.example/extra.jpg"],
      dimensionsWidth: NaN,
      dimensionsHeight: undefined,
    });
    expect(result.media).toEqual([
      {
        position: 0,
        kind: "unknown",
        provider_url: "https://cdn.example/reel-cover.jpg",
        width: null,
        height: null,
        alt: null,
        source: "apify_instagram",
      },
      {
        position: 1,
        kind: "unknown",
        provider_url: "https://cdn.example/extra.jpg",
        width: null,
        height: null,
        alt: null,
        source: "apify_instagram",
      },
    ]);
  });

  it("dedupes repeated provider URLs and caps retained entries at 20", () => {
    const children = Array.from({ length: 25 }, (_, i) =>
      child(i, "Image"),
    ) as ApifyInstagramPost[];
    const result = mapInstagramPostMedia({
      type: "Sidecar",
      displayUrl: "https://cdn.example/carousel-3.jpg",
      images: children.map(c => c.displayUrl),
      childPosts: [...children, child(4, "Image") as ApifyInstagramPost],
    });
    expect(result.media).toHaveLength(20);
    expect(result.media.map(m => m.position)).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(new Set(result.media.map(m => m.provider_url)).size).toBe(20);
    expect(result.media[0].provider_url).toBe("https://cdn.example/carousel-0.jpg");
  });
});
