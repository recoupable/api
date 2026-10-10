import { describe, expect, it } from "vitest";
import { playerInputSchema, listeningEventSchema } from "../schema";
const input = {
  artistId: "10000000-0000-4000-8000-000000000001",
  name: "Release",
  spotifyUrl: "https://open.spotify.com/album/abc123",
  allowedOrigins: ["https://artist.example"],
};
describe("release player configuration", () => {
  it("accepts a reusable release with no artist-specific code", () => {
    expect(playerInputSchema.parse(input)).toMatchObject({ enabled: false, appleUrl: null });
  });
  it.each([
    "https://artist.example/path",
    "https://artist.example?token=x",
    "https://name:password@artist.example",
    "http://artist.example",
  ])("rejects unsafe embed origin %s", origin => {
    expect(playerInputSchema.safeParse({ ...input, allowedOrigins: [origin] }).success).toBe(false);
  });
  it("rejects destinations outside the DSP and forged ownership", () => {
    expect(
      playerInputSchema.safeParse({ ...input, spotifyUrl: "https://evil.example/track/a" }).success,
    ).toBe(false);
    expect(playerInputSchema.safeParse({ ...input, account_id: input.artistId }).success).toBe(
      false,
    );
  });
});
describe("listening events", () => {
  const event = {
    id: crypto.randomUUID(),
    event: "playing",
    provider: "spotify",
    trackId: "abc",
    positionMs: 2000,
    listenedMs: 1000,
  };
  it("bounds reported duration and refuses identity supplied by callers", () => {
    expect(listeningEventSchema.safeParse(event).success).toBe(true);
    expect(listeningEventSchema.safeParse({ ...event, listenedMs: 31000 }).success).toBe(false);
    expect(listeningEventSchema.safeParse({ ...event, fanId: crypto.randomUUID() }).success).toBe(
      false,
    );
  });
});

it("accepts Spotify share links and normalizes provider tracking parameters", () => {
  const input = {
    artistId: "10000000-0000-4000-8000-000000000001",
    name: "Release",
    spotifyUrl: "https://open.spotify.com/intl-en/album/abc123?si=share-token",
  };
  expect(playerInputSchema.parse(input).spotifyUrl).toBe("https://open.spotify.com/album/abc123");
});
