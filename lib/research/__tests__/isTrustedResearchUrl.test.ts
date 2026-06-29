import { describe, expect, it } from "vitest";
import { isTrustedResearchUrl } from "../isTrustedResearchUrl";

describe("isTrustedResearchUrl", () => {
  it("accepts public https URLs", () => {
    expect(isTrustedResearchUrl("https://open.spotify.com/artist/abc")).toBe(true);
    expect(isTrustedResearchUrl("https://music.apple.com/us/artist/id")).toBe(true);
  });

  it("rejects malformed URLs", () => {
    expect(isTrustedResearchUrl("not a url")).toBe(false);
    expect(isTrustedResearchUrl("")).toBe(false);
  });

  it("rejects non-https protocols", () => {
    expect(isTrustedResearchUrl("http://open.spotify.com/artist/abc")).toBe(false);
    expect(isTrustedResearchUrl("javascript:alert(1)")).toBe(false);
    expect(isTrustedResearchUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects URLs with embedded credentials", () => {
    expect(isTrustedResearchUrl("https://user:pass@open.spotify.com/artist/abc")).toBe(false);
  });
});
