import { describe, it, expect, vi } from "vitest";
import { fetchAllThreadResponses } from "../fetchAllThreadResponses";

describe("fetchAllThreadResponses", () => {
  it("calls the extractor for each thread and returns results in order", async () => {
    const extractor = vi
      .fn()
      .mockResolvedValueOnce(["url1"])
      .mockResolvedValueOnce(["url2", "url3"]);

    const threads = [
      { channelId: "C1", ts: "1.0" },
      { channelId: "C2", ts: "2.0" },
    ];

    const result = await fetchAllThreadResponses("token", threads, extractor);

    expect(result).toEqual([["url1"], ["url2", "url3"]]);
    expect(extractor).toHaveBeenCalledWith("token", "C1", "1.0");
    expect(extractor).toHaveBeenCalledWith("token", "C2", "2.0");
  });

  it("returns empty array for threads where extractor rejects", async () => {
    const extractor = vi
      .fn()
      .mockResolvedValueOnce(["url1"])
      .mockRejectedValueOnce(new Error("API error"));

    const threads = [
      { channelId: "C1", ts: "1.0" },
      { channelId: "C2", ts: "2.0" },
    ];

    const result = await fetchAllThreadResponses("token", threads, extractor);

    expect(result).toEqual([["url1"], []]);
  });

  it("returns empty arrays when given no threads", async () => {
    const extractor = vi.fn();
    const result = await fetchAllThreadResponses("token", [], extractor);

    expect(result).toEqual([]);
    expect(extractor).not.toHaveBeenCalled();
  });
});
