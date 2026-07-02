import { describe, it, expect, vi, beforeEach } from "vitest";

import { scrapeProfileUrlBatch } from "@/lib/apify/scrapeProfileUrlBatch";
import { scrapeProfileUrl } from "@/lib/apify/scrapeProfileUrl";

vi.mock("@/lib/apify/scrapeProfileUrl", () => ({ scrapeProfileUrl: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(scrapeProfileUrl).mockResolvedValue({
    runId: "r1",
    datasetId: "d1",
    error: null,
    supported: true,
  });
});

describe("scrapeProfileUrlBatch", () => {
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
