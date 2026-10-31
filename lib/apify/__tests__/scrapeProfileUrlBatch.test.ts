import { describe, it, expect, vi, beforeEach } from "vitest";

import { scrapeProfileUrlBatch } from "@/lib/apify/scrapeProfileUrlBatch";
import { scrapeProfileUrl } from "@/lib/apify/scrapeProfileUrl";

vi.mock("@/lib/apify/scrapeProfileUrl", () => ({ scrapeProfileUrl: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(scrapeProfileUrl).mockResolvedValue({
    state: "started",
    runId: "r1",
    datasetId: "d1",
    error: null,
    supported: true,
  });
});

describe("scrapeProfileUrlBatch", () => {
  it("preserves attempt states and skips unsupported profiles", async () => {
    vi.mocked(scrapeProfileUrl)
      .mockResolvedValueOnce({
        state: "started",
        runId: "r1",
        datasetId: "d1",
        error: null,
        supported: true,
      })
      .mockResolvedValueOnce({
        state: "failed",
        runId: null,
        datasetId: null,
        error: "Failed to start scrape",
        supported: true,
      })
      .mockResolvedValueOnce(null);
    expect(
      await scrapeProfileUrlBatch([
        { profileUrl: "https://x.com/a", username: "a" },
        { profileUrl: "https://youtube.com/@b", username: "b" },
        { profileUrl: "https://unsupported.example/c", username: "c" },
      ]),
    ).toEqual([
      {
        state: "started",
        runId: "r1",
        datasetId: "d1",
        error: null,
        profileUrl: "https://x.com/a",
      },
      {
        state: "failed",
        runId: null,
        datasetId: null,
        error: "Failed to start scrape",
        profileUrl: "https://youtube.com/@b",
      },
    ]);
  });
  it("forwards posts to every scrapeProfileUrl call", async () => {
    await scrapeProfileUrlBatch(
      [
        { profileUrl: "https://x.com/a", username: "a" },
        { profileUrl: "https://youtube.com/@b", username: "b" },
      ],
      20,
    );
    expect(scrapeProfileUrl).toHaveBeenCalledWith("https://x.com/a", "a", 20);
    expect(scrapeProfileUrl).toHaveBeenCalledWith("https://youtube.com/@b", "b", 20);
  });

  it("passes posts as undefined when omitted (legacy behavior)", async () => {
    await scrapeProfileUrlBatch([{ profileUrl: "https://x.com/a", username: "a" }]);
    expect(scrapeProfileUrl).toHaveBeenCalledWith("https://x.com/a", "a", undefined);
  });
});
