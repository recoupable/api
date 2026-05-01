import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleInstagramProfileScraperResults } from "../handleInstagramProfileScraperResults";
import apifyClient from "@/lib/apify/client";
import { upsertPosts } from "@/lib/supabase/posts/upsertPosts";
import { getPosts } from "@/lib/supabase/posts/getPosts";
import { handleInstagramProfileFollowUpRuns } from "../handleInstagramProfileFollowUpRuns";
import { sendApifyWebhookEmail } from "@/lib/apify/sendApifyWebhookEmail";
import { upsertSocials } from "@/lib/supabase/socials/upsertSocials";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { upsertSocialPosts } from "@/lib/supabase/social_posts/upsertSocialPosts";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { uploadLinkToArweave } from "@/lib/arweave/uploadLinkToArweave";

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
vi.mock("@/lib/apify/sendApifyWebhookEmail", () => ({ sendApifyWebhookEmail: vi.fn() }));
vi.mock("@/lib/supabase/socials/upsertSocials", () => ({ upsertSocials: vi.fn() }));
vi.mock("@/lib/supabase/socials/selectSocials", () => ({
  selectSocials: vi.fn(),
}));
vi.mock("@/lib/supabase/social_posts/upsertSocialPosts", () => ({ upsertSocialPosts: vi.fn() }));
vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: vi.fn(),
}));
vi.mock("@/lib/supabase/account_artist_ids/getAccountArtistIds", () => ({
  getAccountArtistIds: vi.fn(),
}));
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
}));
vi.mock("@/lib/arweave/uploadLinkToArweave", () => ({ uploadLinkToArweave: vi.fn() }));

const payload = {
  userId: "u",
  createdAt: "2026-01-01T00:00:00Z",
  eventType: "ACTOR.RUN.SUCCEEDED",
  eventData: { actorId: "dSCLg0C3YEZ83HzYX" },
  resource: { defaultDatasetId: "ds_1" },
} as never;

describe("handleInstagramProfileScraperResults", () => {
  beforeEach(() => vi.clearAllMocks());

  it("short-circuits when the dataset has no latest posts", async () => {
    mockDataset([{ username: "alice" }]);

    const result = await handleInstagramProfileScraperResults(payload);

    expect(result).toMatchObject({ posts: [], social: null });
    expect(upsertPosts).not.toHaveBeenCalled();
  });

  it("persists posts, links social_posts, and fires follow-up runs + email", async () => {
    const posts = [{ id: "p1", post_url: "u1", updated_at: "t" }] as never;
    mockDataset([
      {
        latestPosts: [{ url: "u1", timestamp: "t" }],
        username: "alice",
        url: "instagram.com/alice",
        profilePicUrl: "https://a",
        fullName: "Alice",
      },
    ]);
    vi.mocked(upsertPosts).mockResolvedValue({ data: null, error: null } as never);
    vi.mocked(getPosts).mockResolvedValue(posts);
    vi.mocked(uploadLinkToArweave).mockResolvedValue(null);
    vi.mocked(upsertSocials).mockResolvedValue([] as never);
    vi.mocked(selectSocials).mockResolvedValue([{ id: "s1" }] as never);
    vi.mocked(selectAccountSocials).mockResolvedValue([{ account_id: "a1" }] as never);
    vi.mocked(getAccountArtistIds).mockResolvedValue([{ account_id: "a1" }] as never);
    vi.mocked(selectAccountEmails).mockResolvedValue([{ email: "x@y.com" }] as never);
    vi.mocked(sendApifyWebhookEmail).mockResolvedValue({ id: "email_1" } as never);

    const result = await handleInstagramProfileScraperResults(payload);

    expect(upsertPosts).toHaveBeenCalledOnce();
    expect(upsertSocialPosts).toHaveBeenCalledOnce();
    expect(sendApifyWebhookEmail).toHaveBeenCalledWith(expect.any(Object), ["x@y.com"]);
    expect(handleInstagramProfileFollowUpRuns).toHaveBeenCalledOnce();
    expect(result.social).toEqual({ id: "s1" });
    expect(result.posts).toEqual(posts);
  });
});
