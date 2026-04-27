import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleInstagramProfileScraperResults } from "../handleInstagramProfileScraperResults";
import { getDataset } from "@/lib/apify/getDataset";
import { saveApifyInstagramPosts } from "../saveApifyInstagramPosts";
import { handleInstagramProfileFollowUpRuns } from "../handleInstagramProfileFollowUpRuns";
import { sendApifyWebhookEmail } from "@/lib/apify/sendApifyWebhookEmail";
import { insertSocials } from "@/lib/supabase/socials/insertSocials";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { upsertSocialPosts } from "@/lib/supabase/social_posts/upsertSocialPosts";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { uploadLinkToArweave } from "@/lib/arweave/uploadLinkToArweave";

vi.mock("@/lib/apify/getDataset", () => ({ getDataset: vi.fn() }));
vi.mock("../saveApifyInstagramPosts", () => ({ saveApifyInstagramPosts: vi.fn() }));
vi.mock("../handleInstagramProfileFollowUpRuns", () => ({
  handleInstagramProfileFollowUpRuns: vi.fn(),
}));
vi.mock("@/lib/apify/sendApifyWebhookEmail", () => ({ sendApifyWebhookEmail: vi.fn() }));
vi.mock("@/lib/supabase/socials/insertSocials", () => ({ insertSocials: vi.fn() }));
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

  it("returns the empty shape when the dataset has no latest posts", async () => {
    vi.mocked(getDataset).mockResolvedValue([{ username: "alice" }]);

    const result = await handleInstagramProfileScraperResults(payload);

    expect(result).toMatchObject({ posts: [], social: null });
    expect(saveApifyInstagramPosts).not.toHaveBeenCalled();
  });

  it("persists posts, links social_posts, and fires follow-up runs + email", async () => {
    const posts = [{ id: "p1", post_url: "u1", updated_at: "t" }] as never;
    vi.mocked(getDataset).mockResolvedValue([
      {
        latestPosts: [{ url: "u1", timestamp: "t" }],
        username: "alice",
        url: "instagram.com/alice",
        profilePicUrl: "https://a",
        fullName: "Alice",
      },
    ]);
    vi.mocked(saveApifyInstagramPosts).mockResolvedValue({ supabasePosts: posts });
    vi.mocked(uploadLinkToArweave).mockResolvedValue(null);
    vi.mocked(insertSocials).mockResolvedValue([] as never);
    vi.mocked(selectSocials).mockResolvedValue([{ id: "s1" }] as never);
    vi.mocked(selectAccountSocials).mockResolvedValue([{ account_id: "a1" }] as never);
    vi.mocked(getAccountArtistIds).mockResolvedValue([{ account_id: "a1" }] as never);
    vi.mocked(selectAccountEmails).mockResolvedValue([{ email: "x@y.com" }] as never);
    vi.mocked(sendApifyWebhookEmail).mockResolvedValue({ id: "email_1" } as never);

    const result = await handleInstagramProfileScraperResults(payload);

    expect(upsertSocialPosts).toHaveBeenCalledOnce();
    expect(sendApifyWebhookEmail).toHaveBeenCalledWith(expect.any(Object), ["x@y.com"]);
    expect(handleInstagramProfileFollowUpRuns).toHaveBeenCalledOnce();
    expect(result.social).toEqual({ id: "s1" });
    expect(result.posts).toEqual(posts);
  });
});
