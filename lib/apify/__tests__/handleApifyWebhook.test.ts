import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleApifyWebhook } from "../handleApifyWebhook";
import { handleInstagramProfileScraperResults } from "../instagram/handleInstagramProfileScraperResults";
import { handleInstagramCommentsScraper } from "../instagram/handleInstagramCommentsScraper";

vi.mock("../instagram/handleInstagramProfileScraperResults", () => ({
  handleInstagramProfileScraperResults: vi.fn(),
}));
vi.mock("../instagram/handleInstagramCommentsScraper", () => ({
  handleInstagramCommentsScraper: vi.fn(),
}));

const base = {
  userId: "u",
  createdAt: "2026-01-01T00:00:00Z",
  eventType: "ACTOR.RUN.SUCCEEDED",
  resource: { defaultDatasetId: "ds_1" },
};

describe("handleApifyWebhook", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dispatches Instagram profile actor to profile handler", async () => {
    vi.mocked(handleInstagramProfileScraperResults).mockResolvedValue({ posts: [] } as never);
    await handleApifyWebhook({ ...base, eventData: { actorId: "dSCLg0C3YEZ83HzYX" } });
    expect(handleInstagramProfileScraperResults).toHaveBeenCalledOnce();
    expect(handleInstagramCommentsScraper).not.toHaveBeenCalled();
  });

  it("dispatches Instagram comments actor to comments handler", async () => {
    vi.mocked(handleInstagramCommentsScraper).mockResolvedValue({ comments: [] } as never);
    await handleApifyWebhook({ ...base, eventData: { actorId: "SbK00X0JYCPblD2wp" } });
    expect(handleInstagramCommentsScraper).toHaveBeenCalledOnce();
    expect(handleInstagramProfileScraperResults).not.toHaveBeenCalled();
  });

  it("returns fallback for unhandled actor ids without throwing", async () => {
    const result = await handleApifyWebhook({ ...base, eventData: { actorId: "unknown" } });
    expect(result).toMatchObject({ posts: [], social: null });
  });

  it("swallows handler errors and returns fallback", async () => {
    vi.mocked(handleInstagramCommentsScraper).mockRejectedValueOnce(new Error("boom"));
    const result = await handleApifyWebhook({
      ...base,
      eventData: { actorId: "SbK00X0JYCPblD2wp" },
    });
    expect(result).toMatchObject({ posts: [], social: null });
  });
});
