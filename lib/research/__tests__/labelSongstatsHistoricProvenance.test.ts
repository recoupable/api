import { describe, it, expect } from "vitest";
import { labelSongstatsHistoricProvenance } from "../labelSongstatsHistoricProvenance";

describe("labelSongstatsHistoricProvenance", () => {
  it("labels every history point of every entry with data_source: songstats", () => {
    const result = labelSongstatsHistoricProvenance({
      result: "success",
      stats: [
        {
          source: "deezer",
          data: {
            history: [
              { date: "2026-06-01", streams_total: 1 },
              { date: "2026-06-02", streams_total: 2 },
            ],
          },
        },
      ],
    });

    expect(result.stats?.[0].data?.history).toEqual([
      { date: "2026-06-01", streams_total: 1, data_source: "songstats" },
      { date: "2026-06-02", streams_total: 2, data_source: "songstats" },
    ]);
  });

  it("passes entries without history through unchanged", () => {
    const payload = { result: "success", stats: [{ source: "deezer", data: {} }] };
    expect(labelSongstatsHistoricProvenance(payload)).toEqual(payload);
  });
});
