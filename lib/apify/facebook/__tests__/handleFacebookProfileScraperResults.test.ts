import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleFacebookProfileScraperResults } from "@/lib/apify/facebook/handleFacebookProfileScraperResults";
const listItems = vi.fn();
vi.mock("@/lib/apify/client", () => ({ default: { dataset: vi.fn(() => ({ listItems })) } }));
const upsertSocials = vi.fn();
vi.mock("@/lib/supabase/socials/upsertSocials", () => ({
  upsertSocials: (...a: unknown[]) => upsertSocials(...a),
}));

const payload = {
  eventData: { actorId: "4Hv5RhChiaDk6iwad" },
  resource: { defaultDatasetId: "ds-1" },
} as never;
// Trimmed from real run ICZxdJBrtP1jkPITS (2026-07-01).
const REAL_ITEM = {
  pageUrl: "https://www.facebook.com/facebook",
  facebookUrl: "https://www.facebook.com/facebook",
  pageName: "facebook",
  title: "Facebook",
  profilePictureUrl: "https://scontent.cdn/pic.jpg",
  followers: 154000000,
};
beforeEach(() => {
  vi.clearAllMocks();
  upsertSocials.mockResolvedValue([]);
});

describe("handleFacebookProfileScraperResults", () => {
  it("upserts the page from a real item (keyed on profile_url)", async () => {
    listItems.mockResolvedValue({ items: [REAL_ITEM] });
    await handleFacebookProfileScraperResults(payload);
    expect(upsertSocials).toHaveBeenCalledWith([
      {
        profile_url: "facebook.com/facebook",
        username: "facebook",
        avatar: "https://scontent.cdn/pic.jpg",
        followerCount: 154000000,
      },
    ]);
  });
  it("no-ops on an empty dataset", async () => {
    listItems.mockResolvedValue({ items: [] });
    expect(await handleFacebookProfileScraperResults(payload)).toEqual({ social: null });
    expect(upsertSocials).not.toHaveBeenCalled();
  });
});
