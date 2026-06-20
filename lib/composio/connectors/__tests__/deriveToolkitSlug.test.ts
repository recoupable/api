import { describe, it, expect } from "vitest";
import { deriveToolkitSlug } from "../deriveToolkitSlug";

describe("deriveToolkitSlug", () => {
  it("derives linkedin from LINKEDIN_CREATE_LINKED_IN_POST", () => {
    expect(deriveToolkitSlug("LINKEDIN_CREATE_LINKED_IN_POST")).toBe("linkedin");
  });

  it("derives twitter from TWITTER_CREATION_OF_A_POST", () => {
    expect(deriveToolkitSlug("TWITTER_CREATION_OF_A_POST")).toBe("twitter");
  });

  it("lowercases the leading toolkit token for other slugs", () => {
    expect(deriveToolkitSlug("GMAIL_SEND_EMAIL")).toBe("gmail");
  });
});
