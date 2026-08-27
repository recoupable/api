import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleLinkedinPostsScraperResults } from "@/lib/apify/linkedin/handleLinkedinPostsScraperResults";
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
  eventData: { actorId: "A3cAPGpwBEG8RJwse" },
  resource: { defaultDatasetId: "ds-1" },
} as never;
// Trimmed from a real harvestapi/linkedin-profile-posts item (2026-08-25).
const REAL_ITEM = {
  type: "post",
  id: "7497775273048788992",
  linkedinUrl:
    "https://www.linkedin.com/posts/sweetmantech_musicindustry-activity-7497775273048788992-abcd",
  author: {
    publicIdentifier: "sweetmantech",
    name: "Patrick Sweetman",
    linkedinUrl:
      "https://www.linkedin.com/in/sweetmantech?miniProfileUrn=urn%3Ali%3Afsd_profile%3AACoAAB8h",
    info: "Senior Software Engineer",
    avatar: { url: "https://media.licdn.com/dms/image/photo.jpg" },
  },
  postedAt: { timestamp: 1787608927023, date: "2026-08-24T22:02:07.023Z" },
  engagement: { likes: 7, comments: 2, shares: 1, reactions: [] },
};
beforeEach(() => {
  vi.clearAllMocks();
  upsertSocialsWithSnapshot.mockResolvedValue([]);
  persistPostsForSocial.mockResolvedValue({ posts: [], social: null });
});

describe("handleLinkedinPostsScraperResults", () => {
  it("upserts the author keyed on the query-stripped profile url (no follower count: the posts actor does not report one)", async () => {
    listItems.mockResolvedValue({ items: [REAL_ITEM] });
    await handleLinkedinPostsScraperResults(payload);
    expect(upsertSocialsWithSnapshot).toHaveBeenCalledWith([
      {
        profile_url: "linkedin.com/in/sweetmantech",
        username: "sweetmantech",
        avatar: "https://media.licdn.com/dms/image/photo.jpg",
        bio: "Senior Software Engineer",
      },
    ]);
  });
  it("persists every post with likes/comments/shares, linked to the author", async () => {
    listItems.mockResolvedValue({ items: [REAL_ITEM, { type: "post" }] });
    persistPostsForSocial.mockResolvedValue({ posts: [{ id: "p1" }], social: { id: "s1" } });
    const result = await handleLinkedinPostsScraperResults(payload);
    expect(persistPostsForSocial).toHaveBeenCalledWith({
      postRows: [
        {
          post_url: REAL_ITEM.linkedinUrl,
          updated_at: "2026-08-24T22:02:07.023Z",
          likes: 7,
          comments: 2,
          reposts: 1,
        },
      ],
      profileUrl: "linkedin.com/in/sweetmantech",
    });
    expect(result).toMatchObject({ posts: [{ id: "p1" }], newPostUrls: [REAL_ITEM.linkedinUrl] });
  });
  it("no-ops on an empty dataset", async () => {
    listItems.mockResolvedValue({ items: [] });
    expect(await handleLinkedinPostsScraperResults(payload)).toEqual({ social: null });
    expect(upsertSocialsWithSnapshot).not.toHaveBeenCalled();
  });
});
