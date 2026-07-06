import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import getAlbums from "../getAlbums";

const albumsPage = (ids: string[]) => ({
  albums: ids.map(id => ({ id, release_date: "2020-01-01" })),
});

describe("getAlbums", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches albums in batches of 20 per Spotify request", async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `album${i}`);
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(albumsPage(ids.slice(0, 20))), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(albumsPage(ids.slice(20))), { status: 200 }),
      );

    const { albums, error } = await getAlbums({ ids, accessToken: "tok" });

    expect(error).toBeNull();
    expect(albums).toHaveLength(25);
    expect(fetch).toHaveBeenCalledTimes(2);
    const firstUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(firstUrl).toContain("https://api.spotify.com/v1/albums?ids=");
    expect(decodeURIComponent(firstUrl)).toContain(ids.slice(0, 20).join(","));
  });

  it("returns an error when a Spotify request fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("nope", { status: 500 }));

    const { albums, error } = await getAlbums({ ids: ["a1"], accessToken: "tok" });

    expect(albums).toBeNull();
    expect(error).toBeInstanceOf(Error);
  });

  it("returns [] for no ids without calling Spotify", async () => {
    const { albums, error } = await getAlbums({ ids: [], accessToken: "tok" });

    expect(albums).toEqual([]);
    expect(error).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
