import { describe, it, expect } from "vitest";
import { labelSongstatsProvenance } from "../labelSongstatsProvenance";

describe("labelSongstatsProvenance", () => {
  it("labels every stats entry with data_source: songstats", () => {
    const result = labelSongstatsProvenance({
      result: "success",
      stats: [
        { source: "spotify", data: { streams_total: 1 } },
        { source: "deezer", data: { streams_total: 2 } },
      ],
    });

    expect((result as { stats: Array<{ data_source: string }> }).stats).toEqual([
      { source: "spotify", data: { streams_total: 1 }, data_source: "songstats" },
      { source: "deezer", data: { streams_total: 2 }, data_source: "songstats" },
    ]);
  });

  it("passes through payloads without a stats array", () => {
    expect(labelSongstatsProvenance({ result: "success" })).toEqual({ result: "success" });
    expect(labelSongstatsProvenance(null)).toBeNull();
    expect(labelSongstatsProvenance("x")).toBe("x");
  });
});
