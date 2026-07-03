import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleTiktokProfileScraperResults } from "@/lib/apify/tiktok/handleTiktokProfileScraperResults";
const listItems = vi.fn();
vi.mock("@/lib/apify/client", () => ({ default: { dataset: vi.fn(() => ({ listItems })) } }));
const upsertSocials = vi.fn();
vi.mock("@/lib/supabase/socials/upsertSocials", () => ({
  upsertSocials: (...a: unknown[]) => upsertSocials(...a),
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
  authorMeta: {
    name: "apache_207",
    profileUrl: "https://www.tiktok.com/@apache_207",
    avatar: "https://p16-common-sign.tiktokcdn-us.com/avatar.jpeg",
    signature: "",
    fans: 917500,
    following: 0,
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  upsertSocials.mockResolvedValue([]);
  persistPostsForSocial.mockResolvedValue({ posts: [], social: null });
});

describe("handleTiktokProfileScraperResults", () => {
  it("upserts author profile stats from a real post item (keyed on profile_url)", async () => {
    listItems.mockResolvedValue({ items: [REAL_ITEM] });
    await handleTiktokProfileScraperResults(payload);
    expect(upsertSocials).toHaveBeenCalledWith([
      {
        profile_url: "tiktok.com/@apache_207",
        username: "apache_207",
        avatar: "https://p16-common-sign.tiktokcdn-us.com/avatar.jpeg",
        bio: null,
        followerCount: 917500,
        followingCount: 0,
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
        },
      ],
      profileUrl: "tiktok.com/@apache_207",
    });
  });
  it("no-ops when the dataset is empty or has no authorMeta", async () => {
    listItems.mockResolvedValue({ items: [] });
    expect(await handleTiktokProfileScraperResults(payload)).toEqual({ social: null });
    expect(upsertSocials).not.toHaveBeenCalled();
    expect(persistPostsForSocial).not.toHaveBeenCalled();
  });
});
