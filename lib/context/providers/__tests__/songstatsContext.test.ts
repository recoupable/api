import { expect, it, vi } from "vitest";
import { lookupSongstatsContext } from "../lookupSongstatsContext";
it("reuses the existing client and preserves raw cross-platform evidence", async () => {
  const data = {
    track_info: {
      songstats_track_id: "song",
      links: [
        { source: "apple_music", url: "https://music.apple.com/test" },
        { source: "deezer", url: "https://deezer.com/track/1" },
      ],
    },
  };
  const fetcher = vi.fn(async () => ({ status: 200, data }));
  const result = await lookupSongstatsContext(
    { kind: "recording", isrc: "US-AT2-21-03065" },
    fetcher,
  );
  expect(fetcher).toHaveBeenCalledWith("/tracks/info", { isrc: "USAT22103065" });
  expect(result.evidence).toEqual(data);
  expect(result.identityConfirmed).toBe(false);
  expect(result.trace.provider).toBe("Songstats");
});
it("supports artist Spotify lookup and rejects ambiguous input", async () => {
  const fetcher = vi.fn(async () => ({ status: 200, data: { songstats_artist_id: "a" } }));
  await lookupSongstatsContext({ kind: "artist", spotifyId: "1QzqrU2lmiW9l1mSvliVoM" }, fetcher);
  expect(fetcher).toHaveBeenCalledWith("/artists/info", {
    spotify_artist_id: "1QzqrU2lmiW9l1mSvliVoM",
  });
  await expect(
    lookupSongstatsContext({ kind: "recording", isrc: "bad" }, fetcher),
  ).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledOnce();
});
it("separates no data from errors and does not retry", async () => {
  const fetcher = vi.fn(async () => ({ status: 429, data: { error: "limited" } }));
  await expect(
    lookupSongstatsContext({ kind: "recording", isrc: "USAT22103065" }, fetcher),
  ).rejects.toThrow("429");
  expect(fetcher).toHaveBeenCalledOnce();
  expect(
    (
      await lookupSongstatsContext({ kind: "recording", isrc: "USAT22103065" }, async () => ({
        status: 404,
        data: null,
      }))
    ).status,
  ).toBe("not_found");
  await expect(
    lookupSongstatsContext({ kind: "recording", isrc: "USAT22103065" }, async () => ({
      status: 200,
      data: { error: "failure" },
    })),
  ).rejects.toThrow();
});
