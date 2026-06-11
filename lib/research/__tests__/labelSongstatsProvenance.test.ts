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

    expect(result.stats).toEqual([
      { source: "spotify", data: { streams_total: 1 }, data_source: "songstats" },
      { source: "deezer", data: { streams_total: 2 }, data_source: "songstats" },
    ]);
  });

  it("passes envelope-only payloads through unchanged", () => {
    expect(labelSongstatsProvenance({ result: "success" })).toEqual({ result: "success" });
  });
});
