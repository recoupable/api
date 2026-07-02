import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleYoutubeProfileScraperResults } from "@/lib/apify/youtube/handleYoutubeProfileScraperResults";
const listItems = vi.fn();
vi.mock("@/lib/apify/client", () => ({ default: { dataset: vi.fn(() => ({ listItems })) } }));
const upsertSocials = vi.fn();
vi.mock("@/lib/supabase/socials/upsertSocials", () => ({
  upsertSocials: (...a: unknown[]) => upsertSocials(...a),
}));

const payload = {
  eventData: { actorId: "h7sDV53CddomktSi5" },
  resource: { defaultDatasetId: "ds-1" },
} as never;
// Trimmed from real run H0ZrIAsJJYXLpCAp7 (2026-07-01).
const REAL_ITEM = {
  inputChannelUrl: "https://www.youtube.com/@blackveilbrides",
  channelUrl: "https://www.youtube.com/channel/UCDdKEz8e7m5g",
  channelUsername: "blackveilbrides",
  channelAvatarUrl: "https://yt3.googleusercontent.com/avatar",
  channelDescription: "The official artist channel for Black Veil Brides",
  channelLocation: "United States",
  aboutChannelInfo: { numberOfSubscribers: 2720000, channelTotalViews: 977316227 },
};
beforeEach(() => {
  vi.clearAllMocks();
  upsertSocials.mockResolvedValue([]);
});

describe("handleYoutubeProfileScraperResults", () => {
  it("keys on inputChannelUrl (round-trips the stored @handle row, NOT the /channel/UC… url)", async () => {
    listItems.mockResolvedValue({ items: [REAL_ITEM] });
    await handleYoutubeProfileScraperResults(payload);
    expect(upsertSocials).toHaveBeenCalledWith([
      {
        profile_url: "youtube.com/@blackveilbrides",
        username: "blackveilbrides",
        avatar: "https://yt3.googleusercontent.com/avatar",
        bio: "The official artist channel for Black Veil Brides",
        followerCount: 2720000,
        region: "United States",
      },
    ]);
  });
  it("no-ops on an empty dataset", async () => {
    listItems.mockResolvedValue({ items: [] });
    expect(await handleYoutubeProfileScraperResults(payload)).toEqual({ social: null });
    expect(upsertSocials).not.toHaveBeenCalled();
  });
});
