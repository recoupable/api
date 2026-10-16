import { describe, it, expect, vi, beforeEach } from "vitest";
import supabase from "../../serverClient";
import { upsertPosts } from "../upsertPosts";
import { mapInstagramPostsToRows } from "@/lib/apify/instagram/mapInstagramPostsToRows";

vi.mock("../../serverClient", () => ({ default: { from: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

const MEDIA = [
  {
    position: 0,
    kind: "image",
    provider_url: "https://cdn.example/c0.jpg",
    width: null,
    height: null,
    alt: null,
    source: "apify_instagram",
  },
];

/**
 * postgrest-js sends the union of every row's keys as `columns` and
 * PostgREST fills a key a row omits with NULL. A call is only safe when
 * no row in it is missing a column another row names.
 */
function columnsPostgrestWouldNullFill(rows: Record<string, unknown>[]) {
  const union = new Set(rows.flatMap(row => Object.keys(row)));
  return rows.flatMap(row => [...union].filter(column => !(column in row)));
}

describe("upsertPosts", () => {
  it("merges on post_url so a re-scrape refreshes engagement instead of being ignored", async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);

    await upsertPosts([
      { post_url: "u1", updated_at: "t", views: 5, likes: null, reposts: undefined },
    ]);

    expect(supabase.from).toHaveBeenCalledWith("posts");
    // nullish fields are stripped: an omitted count never clears a stored one
    expect(upsert).toHaveBeenCalledWith([{ post_url: "u1", updated_at: "t", views: 5 }], {
      onConflict: "post_url",
    });
  });

  it("writes rows with different reported columns in separate calls so none is NULL-filled", async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);

    // One Instagram run: a post with caption/media, a legacy post reporting
    // only engagement, and a second engagement-only post.
    await upsertPosts([
      {
        post_url: "carousel",
        updated_at: "t",
        likes: 3,
        caption: "tour recap",
        published_at: "t",
        media: MEDIA,
        media_observed_at: "o",
      },
      { post_url: "legacy", updated_at: "t", likes: 1, caption: null, media: undefined },
      { post_url: "legacy-2", updated_at: "t", likes: 2 },
    ]);

    expect(upsert).toHaveBeenCalledTimes(2);
    for (const [rows, options] of upsert.mock.calls) {
      expect(columnsPostgrestWouldNullFill(rows)).toEqual([]);
      expect(options).toEqual({ onConflict: "post_url" });
    }
    expect(
      upsert.mock.calls.map(([rows]) => rows.map((r: { post_url: string }) => r.post_url)),
    ).toEqual([["carousel"], ["legacy", "legacy-2"]]);
    // the engagement-only call never names the retention columns
    expect(Object.keys(upsert.mock.calls[1][0][0]).sort()).toEqual([
      "likes",
      "post_url",
      "updated_at",
    ]);
  });

  it("never NULL-fills an Instagram run that mixes posts with and without media", async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);

    await upsertPosts(
      mapInstagramPostsToRows([
        {
          url: "https://www.instagram.com/p/alice-carousel",
          caption: "tour recap",
          timestamp: "2026-09-01T12:00:00.000Z",
          displayUrl: "https://cdn/alice-c0.jpg",
          likesCount: 3,
        },
        { url: "https://www.instagram.com/p/alice-legacy", timestamp: "2026-07-01T00:00:00.000Z" },
      ]),
    );

    expect(upsert).toHaveBeenCalledTimes(2);
    for (const [rows] of upsert.mock.calls) expect(columnsPostgrestWouldNullFill(rows)).toEqual([]);
    const legacy = upsert.mock.calls.find(([rows]) => rows[0].post_url.endsWith("alice-legacy"));
    const retentionKeys = Object.keys(legacy![0][0]).filter(key =>
      ["caption", "media", "media_observed_at"].includes(key),
    );
    expect(retentionKeys).toEqual([]);
  });

  it("makes no call for an empty batch", async () => {
    const upsert = vi.fn();
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);
    await upsertPosts([]);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("throws on a database error", async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);
    await expect(upsertPosts([{ post_url: "u1" }])).rejects.toEqual({ message: "boom" });
  });
});
