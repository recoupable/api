import { describe, expect, it } from "vitest";
import { mapArtistAudienceSource } from "../mapArtistAudienceSource";

describe("mapArtistAudienceSource", () => {
  it("maps known platforms to SongStats audience sources", () => {
    expect(mapArtistAudienceSource("instagram")).toBe("instagram_followers");
    expect(mapArtistAudienceSource("youtube_channel")).toBe("youtube_channel_subscribers");
  });

  it("returns the input unchanged for unknown platforms", () => {
    expect(mapArtistAudienceSource("myspace")).toBe("myspace");
  });

  it("does not treat prototype property names as platforms", () => {
    expect(mapArtistAudienceSource("toString")).toBe("toString");
  });
});
