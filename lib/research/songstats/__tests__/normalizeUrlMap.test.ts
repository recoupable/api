import { describe, expect, it } from "vitest";
import { normalizeUrlMap } from "../normalizeUrlMap";

describe("normalizeUrlMap", () => {
  it("collects https platform URLs and skips untrusted values", () => {
    expect(
      normalizeUrlMap({
        links: [
          { platform: "spotify", url: "https://open.spotify.com/artist/abc" },
          { platform: "evil", url: "javascript:alert(1)" },
          { platform: "legacy", url: "http://open.spotify.com/artist/abc" },
        ],
      }),
    ).toEqual({
      spotify: "https://open.spotify.com/artist/abc",
    });
  });

  it("skips bare strings that are not trusted https URLs", () => {
    expect(normalizeUrlMap(["http://example.com", "https://example.com/page"])).toEqual({
      "https://example.com/page": "https://example.com/page",
    });
  });
});
