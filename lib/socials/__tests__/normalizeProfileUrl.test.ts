import { describe, it, expect } from "vitest";
import { normalizeProfileUrl } from "../normalizeProfileUrl";

describe("normalizeProfileUrl", () => {
  it("removes https:// protocol from URL", () => {
    expect(normalizeProfileUrl("https://open.spotify.com/artist/123")).toBe(
      "open.spotify.com/artist/123",
    );
  });

  it("removes http:// protocol from URL", () => {
    expect(normalizeProfileUrl("http://twitter.com/user")).toBe("twitter.com/user");
  });

  it("returns URL unchanged if no protocol", () => {
    expect(normalizeProfileUrl("open.spotify.com/artist/123")).toBe(
      "open.spotify.com/artist/123",
    );
  });

  it("handles empty string", () => {
    expect(normalizeProfileUrl("")).toBe("");
  });

  it("handles null/undefined", () => {
    expect(normalizeProfileUrl(null as unknown as string)).toBe("");
    expect(normalizeProfileUrl(undefined as unknown as string)).toBe("");
  });

  it("removes trailing slash", () => {
    expect(normalizeProfileUrl("https://instagram.com/user/")).toBe(
      "instagram.com/user",
    );
  });
});
