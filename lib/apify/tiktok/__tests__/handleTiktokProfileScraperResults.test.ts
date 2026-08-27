import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleTiktokProfileScraperResults } from "@/lib/apify/tiktok/handleTiktokProfileScraperResults";
const listItems = vi.fn();
vi.mock("@/lib/socials/filterNewPostUrls", () => ({
  filterNewPostUrls: vi.fn(async (urls: string[]) => urls),
}));
vi.mock("@/lib/apify/client", () => ({ default: { dataset: vi.fn(() => ({ listItems })) } }));
const upsertSocialsWithSnapshot = vi.fn();
vi.mock("@/lib/socials/upsertSocialsWithSnapshot", () => ({
  upsertSocialsWithSnapshot: (...a: unknown[]) => upsertSocialsWithSnapshot(...a),
}));
const persistPostsForSocial = vi.fn();
vi.mock("@/lib/apify/persistPostsForSocial", () => ({
  persistPostsForSocial: (...a: unknown[]) => persistPostsForSocial(...a),
}));

const payload = {
  eventData: { actorId: "GdWCkxBtKWOsKjdch" },
  resource: { defaultDatasetId: "ds-1" },
} as never;
// Trimmed from real run G4YRI0eUI0d5IidDN (2026-07-01); post fields
// (webVideoUrl, createTimeISO) verified on real run 9AYX8xyaHWyHtnGtC (2026-07-02).
const REAL_ITEM = {
  text: "In welcher Stadt tanzen wir?",
  webVideoUrl: "https://www.tiktok.com/@apache_207/video/7516257593208147205",
  createTimeISO: "2025-06-15T19:18:17.000Z",
  diggCount: 3800000,
  shareCount: 132100,
  playCount: 32700000,
  commentCount: 45500,
  authorMeta: {
    name: "apache_207",
    profileUrl: "https://www.tiktok.com/@apache_207",
    avatar: "https://p16-common-sign.tiktokcdn-us.com/avatar.jpeg",
    signature: "",
    fans: 917500,
    following: 0,
    video: 221,
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  upsertSocialsWithSnapshot.mockResolvedValue([]);
  persistPostsForSocial.mockResolvedValue({ posts: [], social: null });
});

describe("handleTiktokProfileScraperResults", () => {
  it("upserts author profile stats from a real post item (keyed on profile_url)", async () => {
    listItems.mockResolvedValue({ items: [REAL_ITEM] });
    await handleTiktokProfileScraperResults(payload);
    expect(upsertSocialsWithSnapshot).toHaveBeenCalledWith([
      {
        profile_url: "tiktok.com/@apache_207",
        username: "apache_207",
        avatar: "https://p16-common-sign.tiktokcdn-us.com/avatar.jpeg",
        bio: null,
        followerCount: 917500,
        followingCount: 0,
        postCount: 221,
      },
    ]);
  });
  it("persists post rows from the dataset items, linked to the social", async () => {
    listItems.mockResolvedValue({ items: [REAL_ITEM, { text: "no url item" }] });
    persistPostsForSocial.mockResolvedValue({ posts: [{ id: "p1" }], social: { id: "s1" } });
    await handleTiktokProfileScraperResults(payload);
    expect(persistPostsForSocial).toHaveBeenCalledWith({
      postRows: [
        {
          post_url: "https://www.tiktok.com/@apache_207/video/7516257593208147205",
          updated_at: "2025-06-15T19:18:17.000Z",
          views: 32700000,
          likes: 3800000,
          comments: 45500,
          reposts: 132100,
        },
      ],
      profileUrl: "tiktok.com/@apache_207",
    });
  });
  it("drops an unparseable createTimeISO instead of forwarding it to the upsert", async () => {
    listItems.mockResolvedValue({
      items: [
        {
          ...REAL_ITEM,
          webVideoUrl: "https://www.tiktok.com/@apache_207/video/1",
          createTimeISO: "garbage",
        },
      ],
    });
    persistPostsForSocial.mockResolvedValue({ posts: [], social: null });
    await handleTiktokProfileScraperResults(payload);
    expect(persistPostsForSocial).toHaveBeenCalledWith({
      postRows: [
        {
          post_url: "https://www.tiktok.com/@apache_207/video/1",
          updated_at: undefined,
          views: 32700000,
          likes: 3800000,
          comments: 45500,
          reposts: 132100,
        },
      ],
      profileUrl: "tiktok.com/@apache_207",
    });
  });
  it("no-ops when the dataset is empty or has no authorMeta", async () => {
    listItems.mockResolvedValue({ items: [] });
    expect(await handleTiktokProfileScraperResults(payload)).toEqual({ social: null });
    expect(upsertSocialsWithSnapshot).not.toHaveBeenCalled();
    expect(persistPostsForSocial).not.toHaveBeenCalled();
  });
});
