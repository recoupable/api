import type { loadSiteAlbum } from "./loadSiteAlbum";
import type { ReleaseContext } from "./schema";
/** Preserve recording attribution and saved briefs instead of presenting one track as album evidence. */
export function combineAlbumContext(
  album: Awaited<ReturnType<typeof loadSiteAlbum>>,
  tracks: ReleaseContext[],
): ReleaseContext {
  return {
    release: album.release,
    tracks,
    music: {
      status: tracks.some(track => track.music.status !== "unavailable")
        ? "saved-analysis"
        : "unavailable",
      coverage: "source-defined",
      analysis: tracks
        .map(
          (track, index) =>
            `${index + 1}. ${track.release.title} (${track.release.url})\n${track.music.analysis || track.music.reason || "Analysis unavailable"}`,
        )
        .join("\n\n"),
      reason: [
        `Recording-by-recording evidence; do not generalize one song to the whole album. Lyrics are saved per recording and inform paraphrased themes.`,
        ...album.gaps,
      ].join("\n"),
    },
    research: tracks.find(track => track.research.status === "available")?.research ?? {
      status: "unavailable",
      sources: [],
      reason: "No saved artist research",
    },
  };
}
