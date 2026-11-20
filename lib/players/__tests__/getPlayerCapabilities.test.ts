import { afterEach, expect, it, vi } from "vitest";
import { getPlayerCapabilities } from "../getPlayerCapabilities";
afterEach(() => vi.unstubAllEnvs());
it.each([
  ["", null],
  ["", "https://open.spotify.com/track/abc"],
  ["public-client-id", null],
  ["public-client-id", "https://open.spotify.com/track/abc"],
])("projects only configuration, never fan observations (%s, %s)", (client, release) => {
  vi.stubEnv("SITES_SPOTIFY_CLIENT_ID", client as string);
  expect(getPlayerCapabilities(release)).toEqual({
    version: 1,
    spotify: {
      clientConfiguration: client ? "configured" : "unconfigured",
      releaseConfigured: !!release,
      premiumEligibility: "unknown",
      tokenStatus: "unknown",
      scopeStatus: "unknown",
      playbackSupport: "unknown",
    },
  });
});
