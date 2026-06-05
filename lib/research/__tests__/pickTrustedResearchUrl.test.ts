import { describe, expect, it } from "vitest";
import { pickTrustedResearchUrl } from "../pickTrustedResearchUrl";

describe("pickTrustedResearchUrl", () => {
  it("returns the first trusted link field in key order", () => {
    expect(
      pickTrustedResearchUrl({
        url: "http://example.com",
        link: "javascript:alert(1)",
        href: "https://example.com/artist",
      }),
    ).toBe("https://example.com/artist");
  });

  it("returns undefined when no trusted link exists", () => {
    expect(
      pickTrustedResearchUrl({
        url: "http://example.com",
        href: "ftp://example.com",
      }),
    ).toBeUndefined();
  });
});
