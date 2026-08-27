import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleYoutubeProfileScraperResults } from "@/lib/apify/youtube/handleYoutubeProfileScraperResults";
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
  eventData: { actorId: "h7sDV53CddomktSi5" },
  resource: { defaultDatasetId: "ds-1" },
} as never;
// Trimmed from real run T53twpAtFfFvAEiA3 (2026-08-27): one video item carries
// both the video fields and the channel fields (top level + aboutChannelInfo).
const VIDEO = {
  type: "video",
  url: "https://www.youtube.com/watch?v=IiI3K6iF9rA",
  date: "2026-06-26T14:00:08.000Z",
  viewCount: 2162,
  likes: 68,
  commentsCount: 15,
  inputChannelUrl: "https://www.youtube.com/@adritorron",
  channelUrl: "https://www.youtube.com/channel/UCwllmxeNKdU5kQyydoq33uA",
  channelUsername: "adritorron",
  channelAvatarUrl: "https://yt3.googleusercontent.com/avatar",
  channelDescription: "Official channel",
  channelLocation: "Dominican Republic",
  channelTotalVideos: 104,
  numberOfSubscribers: 108000,
  aboutChannelInfo: { numberOfSubscribers: 108000, channelTotalVideos: 104 },
};
const SHORT = {
  ...VIDEO,
  type: "shorts",
  url: "https://www.youtube.com/shorts/abc123",
  date: "2026-08-01T10:00:00.000Z",
  viewCount: 90000,
  likes: 4000,
  commentsCount: 120,
};
beforeEach(() => {
  vi.clearAllMocks();
  upsertSocialsWithSnapshot.mockResolvedValue([]);
  persistPostsForSocial.mockResolvedValue({ posts: [], social: null });
});

describe("handleYoutubeProfileScraperResults", () => {
  it("keys on inputChannelUrl (round-trips the stored @handle row, NOT the /channel/UC… url) and snapshots the channel", async () => {
    listItems.mockResolvedValue({ items: [VIDEO] });
    await handleYoutubeProfileScraperResults(payload);
    expect(upsertSocialsWithSnapshot).toHaveBeenCalledWith([
      {
        profile_url: "youtube.com/@adritorron",
        username: "adritorron",
        avatar: "https://yt3.googleusercontent.com/avatar",
        bio: "Official channel",
        followerCount: 108000,
        region: "Dominican Republic",
        postCount: 104,
      },
    ]);
  });
  it("persists every video and Short as a post row with view/like/comment counts, linked to the social", async () => {
    listItems.mockResolvedValue({ items: [VIDEO, SHORT, { type: "video" }] });
    persistPostsForSocial.mockResolvedValue({
      posts: [{ id: "p1" }, { id: "p2" }],
      social: { id: "s1" },
    });
    const result = await handleYoutubeProfileScraperResults(payload);
    expect(persistPostsForSocial).toHaveBeenCalledWith({
      postRows: [
        {
          post_url: "https://www.youtube.com/watch?v=IiI3K6iF9rA",
          updated_at: "2026-06-26T14:00:08.000Z",
          views: 2162,
          likes: 68,
          comments: 15,
        },
        {
          post_url: "https://www.youtube.com/shorts/abc123",
          updated_at: "2026-08-01T10:00:00.000Z",
          views: 90000,
          likes: 4000,
          comments: 120,
        },
      ],
      profileUrl: "youtube.com/@adritorron",
    });
    expect(result).toMatchObject({
      posts: [{ id: "p1" }, { id: "p2" }],
      newPostUrls: [
        "https://www.youtube.com/watch?v=IiI3K6iF9rA",
        "https://www.youtube.com/shorts/abc123",
      ],
    });
  });
  it("no-ops on an empty dataset", async () => {
    listItems.mockResolvedValue({ items: [] });
    expect(await handleYoutubeProfileScraperResults(payload)).toEqual({ social: null });
    expect(upsertSocialsWithSnapshot).not.toHaveBeenCalled();
    expect(persistPostsForSocial).not.toHaveBeenCalled();
  });
});
