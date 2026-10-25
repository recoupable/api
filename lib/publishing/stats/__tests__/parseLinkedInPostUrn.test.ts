import { describe, it, expect } from "vitest";
import { parseLinkedInPostUrn } from "../parseLinkedInPostUrn";

describe("parseLinkedInPostUrn", () => {
  it("reads a ugcPost URN from a feed URL", () => {
    expect(
      parseLinkedInPostUrn(
        "https://www.linkedin.com/feed/update/urn:li:ugcPost:7387000000000000001/",
      ),
    ).toEqual({ urn: "urn:li:ugcPost:7387000000000000001", kind: "ugcPosts" });
  });

  it("reads a share URN from a feed URL", () => {
    expect(parseLinkedInPostUrn("https://www.linkedin.com/feed/update/urn:li:share:123/")).toEqual({
      urn: "urn:li:share:123",
      kind: "shares",
    });
  });

  it("returns null when the URL carries no post URN", () => {
    expect(parseLinkedInPostUrn("https://www.linkedin.com/posts/someone_activity-1")).toBeNull();
  });
});
