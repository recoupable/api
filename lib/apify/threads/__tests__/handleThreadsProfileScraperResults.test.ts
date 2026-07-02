import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleThreadsProfileScraperResults } from "@/lib/apify/threads/handleThreadsProfileScraperResults";
const listItems = vi.fn();
vi.mock("@/lib/apify/client", () => ({ default: { dataset: vi.fn(() => ({ listItems })) } }));
const upsertSocials = vi.fn();
vi.mock("@/lib/supabase/socials/upsertSocials", () => ({
  upsertSocials: (...a: unknown[]) => upsertSocials(...a),
}));

const payload = {
  eventData: { actorId: "kJdK90pa2hhYYrCK5" },
  resource: { defaultDatasetId: "ds-1" },
} as never;
// Trimmed from real run 9iiG1sDkpaeWPCWHl (2026-07-01).
const REAL_ITEM = {
  username: "zuck",
  url: "https://www.threads.net/@zuck",
  profile_pic_url: "https://instagram.cdn/pic.jpg",
  biography: "Mostly superintelligence and MMA takes",
  follower_count: 5642746,
};
beforeEach(() => {
  vi.clearAllMocks();
  upsertSocials.mockResolvedValue([]);
});

describe("handleThreadsProfileScraperResults", () => {
  it("upserts the profile from a real item (keyed on profile_url)", async () => {
    listItems.mockResolvedValue({ items: [REAL_ITEM] });
    await handleThreadsProfileScraperResults(payload);
    expect(upsertSocials).toHaveBeenCalledWith([
      {
        profile_url: "threads.net/@zuck",
        username: "zuck",
        avatar: "https://instagram.cdn/pic.jpg",
        bio: "Mostly superintelligence and MMA takes",
        followerCount: 5642746,
      },
    ]);
  });
  it("no-ops on an empty dataset", async () => {
    listItems.mockResolvedValue({ items: [] });
    expect(await handleThreadsProfileScraperResults(payload)).toEqual({ social: null });
    expect(upsertSocials).not.toHaveBeenCalled();
  });
});
