import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleTwitterProfileScraperResults } from "@/lib/apify/twitter/handleTwitterProfileScraperResults";
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
  eventData: { actorId: "nfp1fpt5gUlBwPcor" },
  resource: { defaultDatasetId: "ds-1" },
} as never;
// Trimmed from real run ALVMZYXkh3WHgeGfT (2026-07-01); tweet fields
// (url, createdAt) verified on real run bx3asRqfbNnkKgogG (2026-07-02).
const REAL_ITEM = {
  type: "tweet",
  url: "https://x.com/TheASF/status/2072732371472748952",
  createdAt: "Thu Jul 02 17:21:21 +0000 2026",
  author: {
    userName: "TheASF",
    url: "https://x.com/TheASF",
    profilePicture: "https://pbs.twimg.com/profile_images/pic.jpg",
    description: "The global home for open source software",
    location: "Worldwide",
    followers: 66208,
    following: 210,
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  upsertSocials.mockResolvedValue([]);
  persistPostsForSocial.mockResolvedValue({ posts: [], social: null });
});

describe("handleTwitterProfileScraperResults", () => {
  it("upserts author stats with a LOWERCASED profile_url (matches stored rows; X handles are case-insensitive)", async () => {
    listItems.mockResolvedValue({ items: [REAL_ITEM] });
    await handleTwitterProfileScraperResults(payload);
    expect(upsertSocials).toHaveBeenCalledWith([
      {
        profile_url: "x.com/theasf",
        username: "TheASF",
        avatar: "https://pbs.twimg.com/profile_images/pic.jpg",
        bio: "The global home for open source software",
        followerCount: 66208,
        followingCount: 210,
        region: "Worldwide",
      },
    ]);
  });
  it("persists tweet rows with createdAt converted to ISO, linked to the social", async () => {
    listItems.mockResolvedValue({ items: [REAL_ITEM, { type: "tweet" }] });
    persistPostsForSocial.mockResolvedValue({ posts: [{ id: "p1" }], social: { id: "s1" } });
    await handleTwitterProfileScraperResults(payload);
    expect(persistPostsForSocial).toHaveBeenCalledWith({
      postRows: [
        {
          post_url: "https://x.com/TheASF/status/2072732371472748952",
          updated_at: "2026-07-02T17:21:21.000Z",
        },
      ],
      profileUrl: "x.com/theasf",
    });
  });
  it("no-ops on an empty dataset", async () => {
    listItems.mockResolvedValue({ items: [] });
    expect(await handleTwitterProfileScraperResults(payload)).toEqual({ social: null });
    expect(upsertSocials).not.toHaveBeenCalled();
    expect(persistPostsForSocial).not.toHaveBeenCalled();
  });
});
