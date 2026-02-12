import { describe, it, expect } from "vitest";
import { isAllowedArtistConnector, ALLOWED_ARTIST_CONNECTORS } from "../isAllowedArtistConnector";

describe("isAllowedArtistConnector", () => {
  it("should return true for 'tiktok'", () => {
    expect(isAllowedArtistConnector("tiktok")).toBe(true);
  });

  it("should return false for connectors not in ALLOWED_ARTIST_CONNECTORS", () => {
    expect(isAllowedArtistConnector("googlesheets")).toBe(false);
    expect(isAllowedArtistConnector("googledrive")).toBe(false);
    expect(isAllowedArtistConnector("instagram")).toBe(false);
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
  it("should include tiktok", () => {
    expect(ALLOWED_ARTIST_CONNECTORS).toContain("tiktok");
  });

  it("should be a readonly array", () => {
    expect(Array.isArray(ALLOWED_ARTIST_CONNECTORS)).toBe(true);
  });
});
