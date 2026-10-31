import { describe, it, expect } from "vitest";
import { escapeLinkedInText } from "../escapeLinkedInText";

describe("escapeLinkedInText", () => {
  it("escapes reserved characters", () => {
    expect(escapeLinkedInText("Drake (feat. Lil Wayne) *now*")).toBe(
      "Drake \\(feat. Lil Wayne\\) \\*now\\*",
    );
  });

  it("turns hashtags into hashtag templates", () => {
    expect(escapeLinkedInText("Rights #musicbusiness")).toBe("Rights {hashtag|\\#|musicbusiness}");
  });

  it("leaves plain text alone", () => {
    expect(escapeLinkedInText("780,000 more streams.")).toBe("780,000 more streams.");
  });
});
