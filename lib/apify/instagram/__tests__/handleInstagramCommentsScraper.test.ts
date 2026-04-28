import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleInstagramCommentsScraper } from "../handleInstagramCommentsScraper";
import apifyClient from "@/lib/apify/client";
import { upsertPostComments } from "@/lib/supabase/post_comments/upsertPostComments";
import { getOrCreatePostsForComments } from "../getOrCreatePostsForComments";
import { getOrCreateSocialsForComments } from "../getOrCreateSocialsForComments";
import { startInstagramProfileScraping } from "../startInstagramProfileScraping";

vi.mock("@/lib/apify/client", () => ({ default: { dataset: vi.fn() } }));
vi.mock("@/lib/supabase/post_comments/upsertPostComments", () => ({
  upsertPostComments: vi.fn(),
}));
vi.mock("../getOrCreatePostsForComments", () => ({ getOrCreatePostsForComments: vi.fn() }));
vi.mock("../getOrCreateSocialsForComments", () => ({ getOrCreateSocialsForComments: vi.fn() }));
vi.mock("../startInstagramProfileScraping", () => ({
  startInstagramProfileScraping: vi.fn(),
}));

const mockDataset = (items: unknown[]) =>
  vi
    .mocked(apifyClient.dataset)
    .mockImplementation(() => ({ listItems: () => Promise.resolve({ items }) }) as never);

const payload = {
  userId: "u",
  createdAt: "2026-01-01T00:00:00Z",
  eventType: "ACTOR.RUN.SUCCEEDED",
  eventData: { actorId: "SbK00X0JYCPblD2wp" },
  resource: { defaultDatasetId: "ds_1" },
} as never;

describe("handleInstagramCommentsScraper", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves comments and enqueues fan profile scrape for distinct usernames", async () => {
    mockDataset([
      {
        id: "c1",
        text: "hi",
        timestamp: "t",
        ownerUsername: "alice",
        ownerProfilePicUrl: "",
        postUrl: "u1",
      },
      {
        id: "c2",
        text: "hi2",
        timestamp: "t",
        ownerUsername: "bob",
        ownerProfilePicUrl: "",
        postUrl: "u1",
      },
      {
        id: "c3",
        text: "hi3",
        timestamp: "t",
        ownerUsername: "alice",
        ownerProfilePicUrl: "",
        postUrl: "u2",
      },
    ]);
    vi.mocked(getOrCreatePostsForComments).mockResolvedValue(
      new Map([
        ["u1", { id: "p1", post_url: "u1" }],
        ["u2", { id: "p2", post_url: "u2" }],
      ]) as never,
    );
    vi.mocked(getOrCreateSocialsForComments).mockResolvedValue(
      new Map([
        ["alice", { id: "s1", username: "alice" }],
        ["bob", { id: "s2", username: "bob" }],
      ]) as never,
    );
    vi.mocked(startInstagramProfileScraping).mockResolvedValue({ runId: "r", datasetId: "d" });

    const result = await handleInstagramCommentsScraper(payload);

    expect(upsertPostComments).toHaveBeenCalledOnce();
    const [rows] = vi.mocked(upsertPostComments).mock.calls[0];
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ post_id: "p1", social_id: "s1", comment: "hi" });

    expect(startInstagramProfileScraping).toHaveBeenCalledOnce();
    const [handles] = vi.mocked(startInstagramProfileScraping).mock.calls[0];
    expect(new Set(handles as string[])).toEqual(new Set(["alice", "bob"]));
    expect(result.comments).toHaveLength(3);
    expect(new Set(result.processedPostUrls)).toEqual(new Set(["u1", "u2"]));
  });

  it("skips persistence when the dataset is empty", async () => {
    mockDataset([]);

    const result = await handleInstagramCommentsScraper(payload);

    expect(getOrCreatePostsForComments).not.toHaveBeenCalled();
    expect(getOrCreateSocialsForComments).not.toHaveBeenCalled();
    expect(upsertPostComments).not.toHaveBeenCalled();
    expect(startInstagramProfileScraping).not.toHaveBeenCalled();
    expect(result.comments).toEqual([]);
  });
});
