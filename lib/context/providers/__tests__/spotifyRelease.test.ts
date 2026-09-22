import { expect, it, vi } from "vitest";
import { collectSpotifyReleaseContext } from "../collectSpotifyReleaseContext";
const id = "3vX9jU6Ix8t7XsAWLoZs10";
const next = `https://api.spotify.com/v1/albums/${id}/tracks?offset=1&limit=1`;
const album = {
  id,
  name: "Fixture release",
  label: "Fixture label",
  tracks: { items: [{ id: "track", disc_number: 1, track_number: 1 }], next, offset: 0, total: 2 },
};
it("collects all pages, preserves unavailable slots and records exact source snapshots", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(album))
    .mockResolvedValueOnce(Response.json({ items: [null], next: null, offset: 1, total: 2 }));
  const result = await collectSpotifyReleaseContext({ releaseId: id }, "secret", fetcher);
  expect(result.tracks).toEqual([...album.tracks.items, null]);
  expect(result.trackCoverage.extent).toBe("full");
  expect(result.coverage).toBe("partial");
  expect(result.snapshots[0].payload).toEqual(album);
  expect(result.ownershipVerified).toBe(false);
  expect(JSON.stringify(result)).not.toContain("secret");
});
it.each([
  "https://evil.example/tracks",
  `https://api.spotify.com/v1/albums/OTHER/tracks`,
  `https://user:pass@api.spotify.com/v1/albums/${id}/tracks`,
])("never sends credentials to unsafe pagination %s", async next => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ ...album, tracks: { ...album.tracks, next } }));
  const result = await collectSpotifyReleaseContext({ releaseId: id }, "secret", fetcher);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(result.trackCoverage.extent).toBe("partial");
  expect(result.gaps.length).toBeGreaterThan(0);
});
it("retains first page after provider rate limit without retry", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(album))
    .mockResolvedValueOnce(new Response(null, { status: 429 }));
  const result = await collectSpotifyReleaseContext({ releaseId: id }, "secret", fetcher);
  expect(result.tracks).toHaveLength(1);
  expect(result.snapshots[1].httpStatus).toBe(429);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("marks capped and overlapping pages incomplete and rejects wrong album identity", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(album));
  expect(
    (await collectSpotifyReleaseContext({ releaseId: id, maxPages: 1 }, "secret", fetcher)).gaps,
  ).toContain("Track page limit reached");
  fetcher
    .mockResolvedValueOnce(Response.json(album))
    .mockResolvedValueOnce(
      Response.json({ items: ["duplicate"], offset: 0, total: 2, next: null }),
    );
  const result = await collectSpotifyReleaseContext({ releaseId: id }, "secret", fetcher);
  expect(result.tracks).toHaveLength(1);
  expect(result.trackCoverage.extent).toBe("partial");
  fetcher.mockResolvedValueOnce(Response.json({ ...album, id: "1QzqrU2lmiW9l1mSvliVoM" }));
  await expect(collectSpotifyReleaseContext({ releaseId: id }, "secret", fetcher)).rejects.toThrow(
    "identity mismatch",
  );
});
