import { it, expect, vi } from "vitest";
import { collectContextSocials } from "../collectContextSocials";
const id = "11111111-1111-4111-8111-111111111111";
const post = (n: number) => ({
  id: `p${n}`,
  post_url: `https://www.instagram.com/p/${n}`,
  updated_at: "2026-08-20T00:00:00+00:00",
  views: null,
  likes: n,
  comments: 0,
  reposts: null,
});
const mediaRow = (n: number) => ({
  id: `p${n}`,
  caption: `caption ${n} @friend`,
  published_at: "2026-08-20T00:00:00+00:00",
  media: [
    {
      position: 0,
      kind: "image",
      provider_url: `https://cdn.example/${n}.jpg`,
      width: 1080,
      height: 1350,
      alt: null,
      source: "apify_instagram",
    },
  ],
  media_observed_at: "2026-10-10T12:00:00+00:00",
});
it("does not read profiles without access", async () => {
  const profiles = vi.fn();
  await expect(
    collectContextSocials(id, id, 1, {
      access: async () => false,
      profiles,
      posts: vi.fn(),
      media: vi.fn(),
    }),
  ).rejects.toThrow("accessible");
  expect(profiles).not.toHaveBeenCalled();
});
it("preserves pagination and does not read media when the page has no posts", async () => {
  const media = vi.fn();
  const r = await collectContextSocials(id, id, 1, {
    access: async () => true,
    profiles: async () => [],
    posts: async () => ({ posts: [], totalCount: 60 }),
    media,
  });
  expect(r.nextPostsPage).toBe(2);
  expect(r.gaps).toContain("No linked social profiles");
  expect(r.gaps.join("\n")).not.toMatch(/not returned by this stored-metrics query/);
  expect(r.trace.freshness).toContain("unknown");
  expect(media).not.toHaveBeenCalled();
});
it("retains profile results when the independent post query fails", async () => {
  const result = await collectContextSocials(id, id, 1, {
    access: async () => true,
    profiles: async () => [],
    posts: async () => {
      throw new Error("private database error");
    },
    media: vi.fn(),
  });
  expect(result.totalPosts).toBeNull();
  expect(result.gaps).toContain("Saved post metrics could not be read");
  expect(result.gaps).not.toContain("No saved post metrics");
  expect(JSON.stringify(result)).not.toContain("private database error");
});
it("merges retained captions and media as reference-only provider references", async () => {
  const media = vi.fn(async () => [mediaRow(1), mediaRow(2)]);
  const r = await collectContextSocials(id, id, 1, {
    access: async () => true,
    profiles: async () => [],
    posts: async () => ({ posts: [post(1), post(2)], totalCount: 2 }),
    media,
  });
  expect(media).toHaveBeenCalledWith({ postIds: ["p1", "p2"] });
  expect(r.posts[0]).toEqual({
    ...post(1),
    caption: "caption 1 @friend",
    published_at: "2026-08-20T00:00:00+00:00",
    media: mediaRow(1).media,
    media_observed_at: "2026-10-10T12:00:00+00:00",
    usage_status: "reference_only",
    retained_bytes: null,
    provider_url_status: "may_expire",
  });
  expect(r.gaps.some(g => g.includes("no retained caption/media"))).toBe(false);
  expect(r.gaps).toContain("Linked profiles are not independently verified as official.");
  expect(r.trace.mediaRetention).toMatch(/provider URLs only/i);
  expect(r.trace.mediaRetention).toMatch(/no bytes retained/i);
  expect(r.trace.mediaRetention).toMatch(/not a production asset/i);
});
it("counts posts without retained caption/media instead of claiming imagery is unavailable", async () => {
  const r = await collectContextSocials(id, id, 1, {
    access: async () => true,
    profiles: async () => [],
    posts: async () => ({ posts: [post(1), post(2), post(3)], totalCount: 3 }),
    media: async () => [mediaRow(2), { ...mediaRow(3), caption: null, media: [] }],
  });
  expect(r.posts.map(p => p.caption)).toEqual([null, "caption 2 @friend", null]);
  expect(r.posts.map(p => p.media.length)).toEqual([0, 1, 0]);
  expect(r.posts.every(p => p.usage_status === "reference_only")).toBe(true);
  expect(r.gaps).toContain(
    "2 of 3 posts have no retained caption/media (scraped before media retention or not reported)",
  );
});
it("keeps posts and reports a gap when the media read fails, without leaking the error", async () => {
  const r = await collectContextSocials(id, id, 1, {
    access: async () => true,
    profiles: async () => [],
    posts: async () => ({ posts: [post(1)], totalCount: 1 }),
    media: async () => {
      throw new Error("private media error");
    },
  });
  expect(r.posts).toHaveLength(1);
  expect(r.posts[0]).toMatchObject({ id: "p1", likes: 1, caption: null, media: [] });
  expect(r.gaps).toContain("Saved post captions/media could not be read");
  expect(r.gaps.some(g => g.includes("no retained caption/media"))).toBe(false);
  expect(JSON.stringify(r)).not.toContain("private media error");
});
