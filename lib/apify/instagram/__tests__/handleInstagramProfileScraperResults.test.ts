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
import { filterNewPostUrls } from "@/lib/socials/filterNewPostUrls";
import { selectApifyScraperRun } from "@/lib/supabase/apify_scraper_runs/selectApifyScraperRun";

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
vi.mock("@/lib/socials/filterNewPostUrls", () => ({ filterNewPostUrls: vi.fn() }));
vi.mock("@/lib/supabase/apify_scraper_runs/selectApifyScraperRun", () => ({
  selectApifyScraperRun: vi.fn(async () => null),
}));
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
  beforeEach(() => {
    vi.clearAllMocks();
    // default: everything scraped counts as new (per-test overrides below)
    vi.mocked(filterNewPostUrls).mockImplementation(async urls => urls);
  });

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
    expect(sendApifyWebhookEmail).toHaveBeenCalledWith(expect.any(Object), ["x@y.com"], ["u1"]);
    expect(handleInstagramProfileFollowUpRuns).toHaveBeenCalledOnce();
    expect(result.social).toEqual({ id: "s1" });
    expect(result.posts).toEqual(posts);
  });

  it("skips the alert email when no scraped post is genuinely new (chat#1855)", async () => {
    mockDataset([
      {
        latestPosts: [{ url: "u1", timestamp: "t" }],
        username: "alice",
        url: "instagram.com/alice",
        profilePicUrl: "https://a",
        fullName: "Alice",
      },
    ]);
    vi.mocked(filterNewPostUrls).mockResolvedValue([]); // all already stored
    vi.mocked(upsertPosts).mockResolvedValue({ data: null, error: null } as never);
    vi.mocked(getPosts).mockResolvedValue([{ id: "p1", post_url: "u1" }] as never);
    vi.mocked(uploadLinkToArweave).mockResolvedValue(null);
    vi.mocked(upsertSocials).mockResolvedValue([] as never);
    vi.mocked(selectSocials).mockResolvedValue([{ id: "s1" }] as never);
    vi.mocked(selectAccountSocials).mockResolvedValue([{ account_id: "a1" }] as never);
    vi.mocked(getAccountArtistIds).mockResolvedValue([{ account_id: "a1" }] as never);
    vi.mocked(selectAccountEmails).mockResolvedValue([{ email: "x@y.com" }] as never);

    const result = await handleInstagramProfileScraperResults(payload);

    expect(sendApifyWebhookEmail).not.toHaveBeenCalled();
    // persistence is unaffected — only the notification is gated
    expect(upsertPosts).toHaveBeenCalledOnce();
    expect(upsertSocialPosts).toHaveBeenCalledOnce();
    expect(handleInstagramProfileFollowUpRuns).toHaveBeenCalledOnce();
    expect(result.social).toEqual({ id: "s1" });
  });

  it("suppresses the solo email for digest-batch runs (webhook layer sends ONE digest)", async () => {
    mockDataset([
      {
        latestPosts: [{ url: "u-new", timestamp: "t" }],
        username: "alice",
        url: "instagram.com/alice",
        profilePicUrl: "https://a",
        fullName: "Alice",
      },
    ]);
    vi.mocked(selectApifyScraperRun).mockResolvedValue({
      run_id: "run-1",
      batch_id: "b1",
    } as never);
    vi.mocked(upsertPosts).mockResolvedValue({ data: null, error: null } as never);
    vi.mocked(getPosts).mockResolvedValue([{ id: "p1", post_url: "u-new" }] as never);
    vi.mocked(uploadLinkToArweave).mockResolvedValue(null);
    vi.mocked(upsertSocials).mockResolvedValue([] as never);
    vi.mocked(selectSocials).mockResolvedValue([{ id: "s1" }] as never);
    vi.mocked(selectAccountSocials).mockResolvedValue([{ account_id: "a1" }] as never);
    vi.mocked(getAccountArtistIds).mockResolvedValue([{ account_id: "a1" }] as never);
    vi.mocked(selectAccountEmails).mockResolvedValue([{ email: "x@y.com" }] as never);

    const result = await handleInstagramProfileScraperResults({
      ...(payload as Record<string, unknown>),
      resource: { defaultDatasetId: "ds_1", id: "run-1" },
    } as never);

    expect(sendApifyWebhookEmail).not.toHaveBeenCalled(); // digest covers it
    expect(result.newPostUrls).toEqual(["u-new"]);
  });
});
