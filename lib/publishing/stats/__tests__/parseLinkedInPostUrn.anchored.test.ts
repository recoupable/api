import { describe, it, expect } from "vitest";
import { parseLinkedInPostUrn } from "../parseLinkedInPostUrn";

describe("parseLinkedInPostUrn: only a LinkedIn feed URL", () => {
  it("rejects a URN inside another host's URL", () => {
    expect(parseLinkedInPostUrn("https://example.com/x/urn:li:share:123")).toBeNull();
  });

  it("rejects a URN with trailing characters", () => {
    expect(
      parseLinkedInPostUrn("https://www.linkedin.com/feed/update/urn:li:share:123abc/"),
    ).toBeNull();
  });

  it("accepts the feed URL without a trailing slash", () => {
    expect(parseLinkedInPostUrn("https://www.linkedin.com/feed/update/urn:li:ugcPost:5")).toEqual({
      urn: "urn:li:ugcPost:5",
      kind: "ugcPosts",
    });
  });
});
