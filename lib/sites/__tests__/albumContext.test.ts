import { expect, it, vi } from "vitest";
import { loadSiteAlbum } from "../production/loadSiteAlbum";
import { combineAlbumContext } from "../production/combineAlbumContext";
import type { Site } from "../schema";
import type { ReleaseContext } from "../production/schema";
const m = vi.hoisted(() => ({ read: vi.fn(), authorize: vi.fn() }));
vi.mock("@/lib/context/providers/collectSpotifyReleaseContext", () => ({
  collectSpotifyReleaseContext: m.read,
}));
vi.mock("@/lib/spotify/generateAccessToken", () => ({
  default: vi.fn().mockResolvedValue({ access_token: "token" }),
}));
vi.mock("../authorizeSiteWorkspace", () => ({ authorizeSiteWorkspace: m.authorize }));
const id = "3Mqw7mOaxxoxCA7e7oBtil";
const trackId = "0I0XxqOsh8fEUP6Q5kii2f";
const site = { release_url: `https://open.spotify.com/album/${id}`, owner_id: "owner" } as Site;
it("keeps album identity, all track slots, and explicit unavailable-track gaps", async () => {
  m.read.mockResolvedValue({
    album: { name: "Album", artists: [{ name: "Artist" }], images: [], release_date: "2026" },
    tracks: [{ id: trackId, name: "Song", track_number: 1, disc_number: 1 }, null],
    gaps: [],
    trackCoverage: { extent: "full" },
  });
  const album = await loadSiteAlbum(site, "actor");
  expect(m.authorize).toHaveBeenCalledWith("actor", "owner");
  expect(album.release.url).toBe(site.release_url);
  expect(album.release.artists).toEqual(["Artist"]);
  expect(album.tracks[0].url).toBe(`https://open.spotify.com/track/${trackId}`);
  expect(album.gaps).toHaveLength(1);
});
it("rejects incomplete pagination rather than silently analyzing a subset", async () => {
  m.read.mockResolvedValue({ trackCoverage: { extent: "partial" } });
  await expect(loadSiteAlbum(site, "actor")).rejects.toThrow("track list");
});
it("combines attributed per-track analysis without treating one song as the album", () => {
  const release = {
    url: site.release_url,
    title: "Album",
    artists: ["Artist"],
    artwork: null,
    date: null,
    isrc: null,
    previewUrl: null,
  };
  const track = {
    release: { ...release, url: `https://open.spotify.com/track/${trackId}`, title: "Song" },
    music: {
      status: "saved-analysis",
      coverage: "source-defined",
      analysis: "Audible drums and themes of hope",
    },
    research: { status: "unavailable", sources: [] },
  } as ReleaseContext;
  const result = combineAlbumContext({ release, tracks: [], gaps: ["Track 2 unavailable"] }, [
    track,
  ]);
  expect(result.release).toEqual(release);
  expect(result.tracks).toEqual([track]);
  expect(result.music.analysis).toContain("Song");
  expect(result.music.reason).toContain("Track 2 unavailable");
  expect(result.engine).toBeUndefined();
});

it("preserves missing audio and lyrics alongside usable album tracks", () => {
  const release = {
    url: site.release_url,
    title: "Album",
    artists: ["Artist"],
    artwork: null,
    date: null,
    isrc: null,
    previewUrl: null,
  };
  const missing: ReleaseContext = {
    release: { ...release, title: "Missing song", url: "https://open.spotify.com/track/missing" },
    music: { status: "unavailable", coverage: "none", analysis: "", reason: "Verification failed" },
    research: { status: "unavailable", sources: [] },
    gaps: [
      {
        trackUrl: "https://open.spotify.com/track/missing",
        topic: "audio_source",
        reason: "Verification failed",
      },
    ],
  };
  const available: ReleaseContext = {
    ...missing,
    release: { ...release, title: "Available song" },
    music: {
      status: "saved-analysis",
      coverage: "source-defined",
      analysis: "Verified music analysis",
    },
    gaps: [],
  };
  const result = combineAlbumContext({ release, tracks: [], gaps: [] }, [missing, available]);
  expect(result.music.status).toBe("saved-analysis");
  expect(result.tracks).toHaveLength(2);
  expect(result.gaps).toEqual(missing.gaps);
  expect(result.music.reason).toContain("Missing song: audio_source unavailable");
  expect(result.music.analysis).toContain("Verified music analysis");
});
