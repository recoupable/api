import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleInstagramCommentsScraper } from "../handleInstagramCommentsScraper";
import apifyClient from "@/lib/apify/client";
import { saveApifyInstagramComments } from "../saveApifyInstagramComments";
import { startInstagramProfileScraping } from "../startInstagramProfileScraping";

vi.mock("@/lib/apify/client", () => ({ default: { dataset: vi.fn() } }));
vi.mock("../saveApifyInstagramComments", () => ({ saveApifyInstagramComments: vi.fn() }));
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
    vi.mocked(startInstagramProfileScraping).mockResolvedValue({ runId: "r", datasetId: "d" });

    const result = await handleInstagramCommentsScraper(payload);

    expect(saveApifyInstagramComments).toHaveBeenCalledOnce();
    expect(startInstagramProfileScraping).toHaveBeenCalledOnce();
    const [handles] = vi.mocked(startInstagramProfileScraping).mock.calls[0];
    expect(new Set(handles as string[])).toEqual(new Set(["alice", "bob"]));
    expect(result.comments).toHaveLength(3);
    expect(new Set(result.processedPostUrls)).toEqual(new Set(["u1", "u2"]));
  });
});
