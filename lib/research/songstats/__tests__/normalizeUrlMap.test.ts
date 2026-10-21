import { describe, expect, it } from "vitest";
import { normalizeUrlMap } from "../normalizeUrlMap";

describe("research URL normalization", () => {
  it("keeps only HTTPS links without embedded credentials", () => {
    expect(
      normalizeUrlMap({
        links: [
          { platform: "valid", url: "https://example.com/creator" },
          { platform: "legacy", url: "http://example.com/creator" },
          { platform: "credential", url: "https://user:pass@example.com/creator" },
          { platform: "script", url: "javascript:alert(1)" },
        ],
      }),
    ).toEqual({ valid: "https://example.com/creator" });
  });
  it("uses the first valid url/link/href without duplicate generic keys", () => {
    expect(
      normalizeUrlMap({
        platform: "valid",
        url: "http://example.com/old",
        link: "javascript:alert(1)",
        href: "https://example.com/new",
      }),
    ).toEqual({ valid: "https://example.com/new" });
  });
  it("filters bare URL strings using the same rule", () => {
    expect(
      normalizeUrlMap([
        "http://example.com",
        "https://name@example.com",
        "https://example.com/path",
      ]),
    ).toEqual({ "https://example.com/path": "https://example.com/path" });
  });
  it.each([
    "not a url",
    "https://",
    "ftp://example.com",
    "file:///example",
    "data:text/plain,example",
  ])("does not collect malformed or non-HTTPS links: %s", raw => {
    expect(normalizeUrlMap({ platform: "fixture", url: raw })).toEqual({});
  });
});
