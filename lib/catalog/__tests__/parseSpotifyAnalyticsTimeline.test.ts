import { describe, expect, it } from "vitest";
import { parseSpotifyAnalyticsTimeline } from "../parseSpotifyAnalyticsTimeline";

describe("parseSpotifyAnalyticsTimeline", () => {
  it("preserves explicit zeros, dates and original-byte identity from native song exports", () => {
    const result = parseSpotifyAnalyticsTimeline(
      "\uFEFFdate,streams\r\n2026-09-01,0\r\n2026-09-03,12\r\n",
    );
    expect(result.format).toBe("song_timeline");
    expect(result.daily_streams).toEqual([
      { date: "2026-09-01", streams: 0 },
      { date: "2026-09-03", streams: 12 },
    ]);
    expect(result.content_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.content_sha256).not.toBe(
      parseSpotifyAnalyticsTimeline("date,streams\n2026-09-01,0\n2026-09-03,12\n").content_sha256,
    );
  });
  it("extracts only streams from the verified audience schema", () => {
    const csv =
      "date,listeners,monthly listeners,monthly active listeners,super listeners,streams,playlist adds,saves,followers\n2026-09-01,1,20,4,0,8,1,2,10\n";
    expect(parseSpotifyAnalyticsTimeline(csv)).toMatchObject({
      format: "audience_timeline",
      daily_streams: [{ date: "2026-09-01", streams: 8 }],
    });
  });
  it("accepts quoted simple native fields without inventing a general CSV dialect", () => {
    expect(
      parseSpotifyAnalyticsTimeline('"date","streams"\n"2026-09-01","8"').daily_streams[0].streams,
    ).toBe(8);
  });
  it.each(["-1", "1.2", "NaN", "", "<1000", "9007199254740992"])(
    "rejects unavailable, thresholded or unsafe stream count %s",
    value =>
      expect(() => parseSpotifyAnalyticsTimeline(`date,streams\n2026-09-01,${value}`)).toThrow(),
  );
  it.each(["2026-02-30", "2026-9-01", "not-a-date"])("rejects invalid date %s", value => {
    expect(() => parseSpotifyAnalyticsTimeline(`date,streams\n${value},1`)).toThrow();
  });
  it("rejects conflicting or duplicate dates rather than silently choosing a revision", () => {
    expect(() => parseSpotifyAnalyticsTimeline("date,streams\n2026-09-01,1\n2026-09-01,2")).toThrow(
      /duplicate/i,
    );
  });
  it.each([
    "song,listeners,streams,saves,release_date\nExample,1,8,0,2026-01-01",
    "date,streams,unknown\n2026-09-01,1,2",
    "date,streams\n2026-09-01,1,2",
    "date,streams\n2026-09-01,1\n\n2026-09-02,2",
    "date,streams\n",
  ])("rejects unsupported, malformed or empty exports", csv => {
    expect(() => parseSpotifyAnalyticsTimeline(csv)).toThrow();
  });
  it("bounds input before splitting it", () => {
    expect(() => parseSpotifyAnalyticsTimeline("x".repeat(250_001))).toThrow(/size/i);
  });
});
