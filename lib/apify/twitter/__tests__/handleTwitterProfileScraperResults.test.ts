import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleTwitterProfileScraperResults } from "@/lib/apify/twitter/handleTwitterProfileScraperResults";
const listItems = vi.fn();
vi.mock("@/lib/apify/client", () => ({ default: { dataset: vi.fn(() => ({ listItems })) } }));
const upsertSocials = vi.fn();
vi.mock("@/lib/supabase/socials/upsertSocials", () => ({
  upsertSocials: (...a: unknown[]) => upsertSocials(...a),
}));

const payload = {
  eventData: { actorId: "nfp1fpt5gUlBwPcor" },
  resource: { defaultDatasetId: "ds-1" },
} as never;
// Trimmed from real run ALVMZYXkh3WHgeGfT (2026-07-01).
const REAL_ITEM = {
  type: "tweet",
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
  it("no-ops on an empty dataset", async () => {
    listItems.mockResolvedValue({ items: [] });
    expect(await handleTwitterProfileScraperResults(payload)).toEqual({ social: null });
    expect(upsertSocials).not.toHaveBeenCalled();
  });
});
