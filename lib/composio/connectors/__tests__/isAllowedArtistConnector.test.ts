import { describe, it, expect } from "vitest";
import { isAllowedArtistConnector, ALLOWED_ARTIST_CONNECTORS } from "../isAllowedArtistConnector";

describe("isAllowedArtistConnector", () => {
  it("should return true for allowed artist connectors", () => {
    expect(isAllowedArtistConnector("tiktok")).toBe(true);
    expect(isAllowedArtistConnector("spotify")).toBe(true);
    expect(isAllowedArtistConnector("instagram")).toBe(true);
    expect(isAllowedArtistConnector("twitter")).toBe(true);
    expect(isAllowedArtistConnector("youtube")).toBe(true);
  });

  it("should return false for connectors not in ALLOWED_ARTIST_CONNECTORS", () => {
    expect(isAllowedArtistConnector("googlesheets")).toBe(false);
    expect(isAllowedArtistConnector("googledrive")).toBe(false);
    expect(isAllowedArtistConnector("slack")).toBe(false);
    expect(isAllowedArtistConnector("random")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(isAllowedArtistConnector("")).toBe(false);
  });

  it("should be case-sensitive", () => {
    expect(isAllowedArtistConnector("TikTok")).toBe(false);
    expect(isAllowedArtistConnector("TIKTOK")).toBe(false);
  });
});

describe("ALLOWED_ARTIST_CONNECTORS", () => {
  it("should include all expected artist connectors", () => {
    expect(ALLOWED_ARTIST_CONNECTORS).toContain("tiktok");
    expect(ALLOWED_ARTIST_CONNECTORS).toContain("spotify");
    expect(ALLOWED_ARTIST_CONNECTORS).toContain("instagram");
    expect(ALLOWED_ARTIST_CONNECTORS).toContain("twitter");
    expect(ALLOWED_ARTIST_CONNECTORS).toContain("youtube");
  });

  it("should be a readonly array", () => {
    expect(Array.isArray(ALLOWED_ARTIST_CONNECTORS)).toBe(true);
  });
});
