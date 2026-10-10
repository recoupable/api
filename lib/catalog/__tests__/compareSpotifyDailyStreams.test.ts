import { describe, expect, it } from "vitest";
import { compareSpotifyDailyStreams } from "../compareSpotifyDailyStreams";

const rows = (counts: number[]) =>
  counts.map((streams, i) => ({ date: `2026-09-0${i + 1}`, streams }));
const query = { since: "2026-09-03", days: 2 };
const now = new Date("2026-09-05T00:00:00Z");

describe("compareSpotifyDailyStreams", () => {
  it("sums dated daily streams instead of subtracting cumulative endpoints", () => {
    expect(compareSpotifyDailyStreams(rows([2, 3, 4, 6]), query, now)).toMatchObject({
      state: "comparable",
      previous_streams: 5,
      current_streams: 10,
      absolute_growth: 5,
      percentage_growth: 100,
      zero_baseline: false,
    });
  });
  it("keeps a zero baseline percentage undefined", () => {
    expect(compareSpotifyDailyStreams(rows([0, 0, 0, 1]), query, now)).toMatchObject({
      state: "comparable",
      previous_streams: 0,
      current_streams: 1,
      percentage_growth: null,
      zero_baseline: true,
    });
  });
  it("does not fill a missing day with zero", () => {
    expect(compareSpotifyDailyStreams(rows([2, 3, 4, 6]).slice(1), query, now)).toMatchObject({
      state: "incomplete",
      missing_days: ["2026-09-01"],
      current_streams: null,
      previous_streams: null,
      percentage_growth: null,
    });
  });
  it("suppresses growth until every compared UTC day has finished", () => {
    expect(
      compareSpotifyDailyStreams(rows([2, 3, 4, 6]), query, new Date("2026-09-04T23:59:59Z")),
    ).toMatchObject({
      state: "unfinished_period",
      current_streams: null,
      percentage_growth: null,
    });
  });
  it("rejects duplicate or invalid observations in the comparison", () => {
    expect(
      compareSpotifyDailyStreams([...rows([2, 3, 4, 6]), rows([2])[0]], query, now).state,
    ).toBe("invalid_observation");
    expect(compareSpotifyDailyStreams(rows([2, -1, 4, 6]), query, now).state).toBe(
      "invalid_observation",
    );
  });
  it("suppresses totals that exceed safe integer precision", () => {
    expect(
      compareSpotifyDailyStreams(rows([Number.MAX_SAFE_INTEGER, 1, 1, 1]), query, now).state,
    ).toBe("invalid_observation");
  });
  it("requires a valid bounded query", () => {
    expect(() => compareSpotifyDailyStreams([], { since: "2026-02-30", days: 2 }, now)).toThrow();
    expect(() => compareSpotifyDailyStreams([], { ...query, days: 0 }, now)).toThrow();
    expect(() => compareSpotifyDailyStreams([], query, new Date("bad"))).toThrow();
  });
});
