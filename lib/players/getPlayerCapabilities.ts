/** Configuration observations only; never proof of fan eligibility or playback authority. */
export function getPlayerCapabilities(spotifyUrl: string | null) {
  return {
    version: 1 as const,
    spotify: {
      clientConfiguration: process.env.SITES_SPOTIFY_CLIENT_ID
        ? ("configured" as const)
        : ("unconfigured" as const),
      releaseConfigured: !!spotifyUrl,
      premiumEligibility: "unknown" as const,
      tokenStatus: "unknown" as const,
      scopeStatus: "unknown" as const,
      playbackSupport: "unknown" as const,
    },
  };
}
