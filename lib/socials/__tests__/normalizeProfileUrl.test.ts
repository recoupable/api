import { describe, it, expect } from "vitest";
import { normalizeProfileUrl } from "../normalizeProfileUrl";

describe("normalizeProfileUrl", () => {
  it("removes https:// protocol from URL", () => {
    expect(normalizeProfileUrl("https://open.spotify.com/artist/123")).toBe(
      "open.spotify.com/artist/123",
    );
  });

  it("removes http:// protocol from URL", () => {
    expect(normalizeProfileUrl("http://twitter.com/user")).toBe("x.com/user");
  });

  it("returns URL unchanged if no protocol", () => {
    expect(normalizeProfileUrl("open.spotify.com/artist/123")).toBe("open.spotify.com/artist/123");
  });

  it("handles empty string", () => {
    expect(normalizeProfileUrl("")).toBe("");
  });

  it("handles null/undefined", () => {
    expect(normalizeProfileUrl(null as unknown as string)).toBe("");
    expect(normalizeProfileUrl(undefined as unknown as string)).toBe("");
  });

  it("removes trailing slash", () => {
    expect(normalizeProfileUrl("https://instagram.com/user/")).toBe("instagram.com/user");
  });

  it("removes www. prefix from URL", () => {
    expect(normalizeProfileUrl("https://www.instagram.com/user")).toBe("instagram.com/user");
  });

  it("removes www. prefix along with protocol and trailing slash", () => {
    expect(normalizeProfileUrl("https://www.instagram.com/goosebytheway/")).toBe(
      "instagram.com/goosebytheway",
    );
  });

  it("handles URL with www. but without protocol", () => {
    expect(normalizeProfileUrl("www.twitter.com/user")).toBe("x.com/user");
  });

  it("canonicalizes twitter.com to x.com (chat#1851)", () => {
    expect(normalizeProfileUrl("https://twitter.com/ashnikko")).toBe("x.com/ashnikko");
    expect(normalizeProfileUrl("https://www.twitter.com/KETTAMA_/")).toBe("x.com/KETTAMA_");
    expect(normalizeProfileUrl("twitter.com/disclosure")).toBe("x.com/disclosure");
  });

  it("produces the same key for twitter.com and x.com spellings", () => {
    expect(normalizeProfileUrl("https://x.com/Foo")).toBe(
      normalizeProfileUrl("https://twitter.com/Foo"),
    );
  });

  it("leaves x.com URLs unchanged", () => {
    expect(normalizeProfileUrl("https://x.com/ashnikko")).toBe("x.com/ashnikko");
  });

  it("does not rewrite domains that merely contain twitter.com", () => {
    expect(normalizeProfileUrl("https://nottwitter.com/user")).toBe("nottwitter.com/user");
    expect(normalizeProfileUrl("https://example.com/twitter.com/user")).toBe(
      "example.com/twitter.com/user",
    );
  });

  it("canonicalizes a bare twitter.com domain with no path", () => {
    expect(normalizeProfileUrl("https://twitter.com")).toBe("x.com");
  });
});
