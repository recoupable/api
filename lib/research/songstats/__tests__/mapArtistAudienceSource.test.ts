import { describe, expect, it } from "vitest";
import { mapArtistAudienceSource } from "../mapArtistAudienceSource";

describe("audience source mapping", () => {
  it.each(["toString", "constructor", "__proto__", "myspace"])(
    "returns unknown source %s unchanged",
    source => {
      expect(mapArtistAudienceSource(source)).toBe(source);
    },
  );
  it("preserves known source names", () => {
    expect(mapArtistAudienceSource("spotify")).toBe("spotify_streams");
    expect(mapArtistAudienceSource("youtube_channel")).toBe("youtube_channel_subscribers");
  });
});
