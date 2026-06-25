import { describe, expect, it } from "vitest";
import { formatResearchUrlsResponse } from "../formatResearchUrlsResponse";

describe("formatResearchUrlsResponse", () => {
  it("maps trusted entries and drops untrusted URLs", () => {
    expect(
      formatResearchUrlsResponse({
        spotify: "https://open.spotify.com/artist/abc",
        evil: "javascript:alert(1)",
        legacy: "http://open.spotify.com/artist/abc",
      }),
    ).toEqual([{ domain: "spotify", url: "https://open.spotify.com/artist/abc" }]);
  });

  it("returns an empty array for non-objects", () => {
    expect(formatResearchUrlsResponse(null)).toEqual([]);
    expect(formatResearchUrlsResponse([{ domain: "x", url: "https://a.com" }])).toEqual([]);
  });
});
