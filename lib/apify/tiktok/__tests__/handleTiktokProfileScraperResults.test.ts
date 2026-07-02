import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleTiktokProfileScraperResults } from "@/lib/apify/tiktok/handleTiktokProfileScraperResults";
const listItems = vi.fn();
vi.mock("@/lib/apify/client", () => ({ default: { dataset: vi.fn(() => ({ listItems })) } }));
const upsertSocials = vi.fn();
vi.mock("@/lib/supabase/socials/upsertSocials", () => ({
  upsertSocials: (...a: unknown[]) => upsertSocials(...a),
}));

const payload = {
  eventData: { actorId: "GdWCkxBtKWOsKjdch" },
  resource: { defaultDatasetId: "ds-1" },
} as never;
// Trimmed from real run G4YRI0eUI0d5IidDN (2026-07-01).
const REAL_ITEM = {
  text: "In welcher Stadt tanzen wir?",
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
  it("no-ops when the dataset is empty or has no authorMeta", async () => {
    listItems.mockResolvedValue({ items: [] });
    expect(await handleTiktokProfileScraperResults(payload)).toEqual({ social: null });
    expect(upsertSocials).not.toHaveBeenCalled();
  });
});
