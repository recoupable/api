import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleInstagramProfileScraperResults } from "../handleInstagramProfileScraperResults";
import apifyClient from "@/lib/apify/client";
import { upsertPosts } from "@/lib/supabase/posts/upsertPosts";
import { getPosts } from "@/lib/supabase/posts/getPosts";
import { handleInstagramProfileFollowUpRuns } from "../handleInstagramProfileFollowUpRuns";
import { upsertSocialsWithSnapshot } from "@/lib/socials/upsertSocialsWithSnapshot";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { upsertSocialPosts } from "@/lib/supabase/social_posts/upsertSocialPosts";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { uploadLinkToArweave } from "@/lib/arweave/uploadLinkToArweave";
import { filterNewPostUrls } from "@/lib/socials/filterNewPostUrls";

vi.mock("@/lib/apify/client", () => ({ default: { dataset: vi.fn() } }));
const mockDataset = (items: unknown[]) =>
  vi
    .mocked(apifyClient.dataset)
    .mockImplementation(() => ({ listItems: () => Promise.resolve({ items }) }) as never);

vi.mock("@/lib/supabase/posts/upsertPosts", () => ({ upsertPosts: vi.fn() }));
vi.mock("@/lib/supabase/posts/getPosts", () => ({ getPosts: vi.fn() }));
vi.mock("../handleInstagramProfileFollowUpRuns", () => ({
  handleInstagramProfileFollowUpRuns: vi.fn(),
}));
vi.mock("@/lib/socials/filterNewPostUrls", () => ({ filterNewPostUrls: vi.fn() }));
vi.mock("@/lib/socials/upsertSocialsWithSnapshot", () => ({ upsertSocialsWithSnapshot: vi.fn() }));
vi.mock("@/lib/supabase/socials/selectSocials", () => ({ selectSocials: vi.fn() }));
vi.mock("@/lib/supabase/social_posts/upsertSocialPosts", () => ({ upsertSocialPosts: vi.fn() }));
vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: vi.fn(),
}));
vi.mock("@/lib/arweave/uploadLinkToArweave", () => ({ uploadLinkToArweave: vi.fn() }));

// Trimmed from real run If5ejeh2vftXWObwa (2026-08-27, a commenter profile).
const profile = (username: string, extra: Record<string, unknown> = {}) => ({
  username,
  url: `https://www.instagram.com/${username}`,
  biography: `bio of ${username}`,
  followersCount: 597,
  followsCount: 6577,
  postsCount: 236,
  profilePicUrl: `https://cdn/${username}.jpg`,
  profilePicUrlHD: `https://cdn/${username}-hd.jpg`,
  latestPosts: [
    {
      url: `https://www.instagram.com/p/${username}1`,
      timestamp: "2026-08-20T00:00:00.000Z",
      likesCount: 10,
      commentsCount: 2,
    },
  ],
  ...extra,
});

const artistPayload = {
  eventData: { actorId: "dSCLg0C3YEZ83HzYX" },
  resource: { id: "run-1", defaultDatasetId: "ds_1" },
  origin: "artist",
} as never;
const fanPayload = { ...(artistPayload as object), origin: "fan" } as never;
const legacyPayload = {
  eventData: { actorId: "dSCLg0C3YEZ83HzYX" },
  resource: { id: "run-0", defaultDatasetId: "ds_0" },
} as never;

describe("handleInstagramProfileScraperResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(filterNewPostUrls).mockImplementation(async urls => urls);
    vi.mocked(upsertSocialsWithSnapshot).mockResolvedValue([] as never);
    vi.mocked(upsertPosts).mockResolvedValue({ data: null, error: null } as never);
    vi.mocked(getPosts).mockResolvedValue([]);
    vi.mocked(uploadLinkToArweave).mockResolvedValue(null);
    vi.mocked(selectSocials).mockResolvedValue([{ id: "s1" }] as never);
    vi.mocked(selectAccountSocials).mockResolvedValue([{ account_id: "a1" }] as never);
  });

  it("short-circuits on an empty dataset", async () => {
    mockDataset([]);
    expect(await handleInstagramProfileScraperResults(artistPayload)).toEqual({
      posts: [],
      social: null,
    });
    expect(upsertSocialsWithSnapshot).not.toHaveBeenCalled();
  });

  it("fan batch: enriches EVERY profile in the dataset (avatar, bio, counts) and is terminal — no posts, no follow-ups, no Arweave", async () => {
    const names = Array.from({ length: 12 }, (_, i) => `fan${i}`);
    mockDataset(names.map(n => profile(n)));

    const result = await handleInstagramProfileScraperResults(fanPayload);

    expect(upsertSocialsWithSnapshot).toHaveBeenCalledOnce();
    const [rows] = vi.mocked(upsertSocialsWithSnapshot).mock.calls[0];
    expect(rows).toHaveLength(12);
    expect(rows[3]).toEqual({
      username: "fan3",
      profile_url: "instagram.com/fan3",
      avatar: "https://cdn/fan3.jpg",
      bio: "bio of fan3",
      followerCount: 597,
      followingCount: 6577,
      postCount: 236,
    });
    expect(uploadLinkToArweave).not.toHaveBeenCalled();
    expect(upsertPosts).not.toHaveBeenCalled();
    expect(handleInstagramProfileFollowUpRuns).not.toHaveBeenCalled();
    expect(result).toEqual({ posts: [], social: null, socials: 12 });
  });

  it("recursion fixture: a fan run whose dataset is ONE profile with posts still schedules nothing", async () => {
    mockDataset([profile("xxmeechie53xx")]);
    await handleInstagramProfileScraperResults(fanPayload);
    expect(handleInstagramProfileFollowUpRuns).not.toHaveBeenCalled();
    expect(upsertPosts).not.toHaveBeenCalled();
  });

  it("legacy payload without origin (a run started before lineage shipped) is treated as terminal", async () => {
    mockDataset([profile("alice")]);
    await handleInstagramProfileScraperResults(legacyPayload);
    expect(upsertSocialsWithSnapshot).toHaveBeenCalledOnce();
    expect(handleInstagramProfileFollowUpRuns).not.toHaveBeenCalled();
    expect(upsertPosts).not.toHaveBeenCalled();
  });

  it("artist run linked to an account: Arweave avatar, posts with engagement, social_posts, follow-ups with lineage", async () => {
    const p = profile("alice");
    mockDataset([p]);
    vi.mocked(uploadLinkToArweave).mockResolvedValue("tx123");
    const posts = [
      { id: "p1", post_url: "https://www.instagram.com/p/alice1", updated_at: "t" },
    ] as never;
    vi.mocked(getPosts).mockResolvedValue(posts);

    const result = await handleInstagramProfileScraperResults(artistPayload);

    expect(uploadLinkToArweave).toHaveBeenCalledWith("https://cdn/alice-hd.jpg");
    const [rows] = vi.mocked(upsertSocialsWithSnapshot).mock.calls[0];
    expect(rows[0]).toMatchObject({
      profile_url: "instagram.com/alice",
      avatar: expect.stringContaining("tx123"),
    });
    expect(upsertPosts).toHaveBeenCalledWith([
      {
        post_url: "https://www.instagram.com/p/alice1",
        updated_at: "2026-08-20T00:00:00.000Z",
        likes: 10,
        comments: 2,
      },
    ]);
    expect(upsertSocialPosts).toHaveBeenCalledWith([
      { post_id: "p1", updated_at: "t", social_id: "s1" },
    ]);
    expect(handleInstagramProfileFollowUpRuns).toHaveBeenCalledWith(
      expect.objectContaining({ username: "alice" }),
      { origin: "artist", parentRunId: "run-1" },
    );
    expect(result).toMatchObject({
      social: { id: "s1" },
      posts,
      newPostUrls: ["https://www.instagram.com/p/alice1"],
    });
  });

  it("artist run whose profile is linked to NO account: persists posts but schedules no follow-ups", async () => {
    mockDataset([profile("orphan")]);
    vi.mocked(selectAccountSocials).mockResolvedValue([]);
    vi.mocked(getPosts).mockResolvedValue([{ id: "p1", post_url: "u", updated_at: "t" }] as never);

    await handleInstagramProfileScraperResults(artistPayload);

    expect(upsertPosts).toHaveBeenCalledOnce();
    expect(handleInstagramProfileFollowUpRuns).not.toHaveBeenCalled();
  });

  it("follow-up failure is logged, never thrown", async () => {
    mockDataset([profile("alice")]);
    vi.mocked(getPosts).mockResolvedValue([{ id: "p1", post_url: "u", updated_at: "t" }] as never);
    vi.mocked(handleInstagramProfileFollowUpRuns).mockRejectedValue(new Error("apify down"));
    await expect(handleInstagramProfileScraperResults(artistPayload)).resolves.toMatchObject({
      social: { id: "s1" },
    });
  });
});
