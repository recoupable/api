import { describe, it, expect } from "vitest";
import { computePlaycountDeltas } from "../computePlaycountDeltas";

const row = (capturedAt: string, value: number, platform = "spotify") =>
  ({
    song: "USA2P2015959",
    platform,
    metric: "platform_displayed_play_count",
    value,
    captured_at: capturedAt,
    data_source: "apify_spotify_playcount",
  }) as never;

describe("computePlaycountDeltas", () => {
  it("computes delta, days, and annualized run-rate between nearest captures", () => {
    const rows = [
      row("2026-07-09T07:00:00Z", 1365000000), // until: latest
      row("2026-06-09T07:00:00Z", 1331384578), // since: nearest at/after 2026-06-01
      row("2026-01-01T00:00:00Z", 1200000000), // before window
    ];

    const deltas = computePlaycountDeltas(rows, { since: "2026-06-01" });

    expect(deltas).toEqual([
      {
        platform: "spotify",
        metric: "platform_displayed_play_count",
        since: { captured_at: "2026-06-09T07:00:00Z", value: 1331384578 },
        until: { captured_at: "2026-07-09T07:00:00Z", value: 1365000000 },
        delta: 33615422,
        days: 30,
        run_rate_annualized: 408987634,
      },
    ]);
  });

  it("honors until as an inclusive upper bound", () => {
    const rows = [
      row("2026-07-09T07:00:00Z", 1365000000),
      row("2026-06-19T07:00:00Z", 1343000000),
      row("2026-06-09T07:00:00Z", 1331384578),
    ];

    const deltas = computePlaycountDeltas(rows, { since: "2026-06-01", until: "2026-06-30" });

    expect(deltas[0].until).toEqual({ captured_at: "2026-06-19T07:00:00Z", value: 1343000000 });
  });

  it("returns no delta for a group with fewer than two captures in the window", () => {
    expect(
      computePlaycountDeltas([row("2026-06-09T07:00:00Z", 1)], { since: "2026-06-01" }),
    ).toEqual([]);
  });

  it("groups by platform + metric", () => {
    const rows = [
      row("2026-07-09T00:00:00Z", 200),
      row("2026-06-09T00:00:00Z", 100),
      row("2026-07-09T00:00:00Z", 20, "tiktok"),
      row("2026-06-09T00:00:00Z", 10, "tiktok"),
    ];

    const deltas = computePlaycountDeltas(rows, { since: "2026-06-01" });

    expect(deltas.map(d => d.platform).sort()).toEqual(["spotify", "tiktok"]);
  });
});
