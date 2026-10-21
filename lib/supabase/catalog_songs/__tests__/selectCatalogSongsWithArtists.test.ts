import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectCatalogSongsWithArtists } from "../selectCatalogSongsWithArtists";

const fixtureFetch = vi.hoisted(() => vi.fn<typeof fetch>());
vi.mock("@/lib/supabase/serverClient", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    default: createClient("https://catalog-fixture.invalid", "synthetic-fixture-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fixtureFetch },
    }),
  };
});

const account = { id: "creator-a", name: "Creator A", timestamp: "2026-01-01T00:00:00Z" };
const row = (artists: unknown[] | null = [{ artist: account.id, accounts: account }]) => ({
  catalog: "catalog-fixture",
  songs: {
    isrc: "USXXX2600001",
    name: "Fixture song",
    album: null,
    notes: null,
    updated_at: "2026-01-01T00:00:00Z",
    song_artists: artists,
  },
});
function respond(data: unknown[], count: number) {
  fixtureFetch.mockResolvedValue(
    new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-range": `0-${Math.max(0, data.length - 1)}/${count}`,
      },
    }),
  );
}
function sentQuery() {
  expect(fixtureFetch).toHaveBeenCalledTimes(1);
  const [url] = fixtureFetch.mock.calls[0];
  return new URL(String(url)).searchParams;
}

beforeEach(() => fixtureFetch.mockReset());

describe("catalog artist filtering through the real Supabase query client", () => {
  it("restricts every embedded artist relation when requesting a creator", async () => {
    respond([row()], 7);
    const result = await selectCatalogSongsWithArtists({
      catalogId: "catalog-fixture",
      artistName: "Creator A",
      isrcs: ["USXXX2600001"],
      page: 2,
      limit: 2,
    });
    const query = sentQuery();
    const selection = query.get("select")!;
    expect(selection).toContain("songs!inner(");
    expect(selection).toContain("song_artists!inner(");
    expect(selection).toContain("accounts!inner(");
    expect(query.get("songs.song_artists.accounts.name")).toBe("eq.Creator A");
    expect(query.get("catalog")).toBe("eq.catalog-fixture");
    expect(query.get("song")).toBe("in.(USXXX2600001)");
    expect(query.get("order")).toBe("song.desc");
    expect(query.get("offset")).toBe("2");
    expect(query.get("limit")).toBe("2");
    expect(new Headers(fixtureFetch.mock.calls[0][1]?.headers).get("prefer")).toContain(
      "count=exact",
    );
    expect(result.total_count).toBe(7);
    expect(result.songs[0].artists).toEqual([account]);
  });

  it("preserves a zero-match response and exact count for the caller's fallback", async () => {
    respond([], 0);
    const result = await selectCatalogSongsWithArtists({ artistName: "Unknown creator" });
    const query = sentQuery();
    expect(query.get("select")).toContain("song_artists!inner(");
    expect(query.get("select")).toContain("accounts!inner(");
    expect(query.get("songs.song_artists.accounts.name")).toBe("eq.Unknown creator");
    expect(result).toEqual({ songs: [], total_count: 0 });
  });

  it("keeps left joins and artist-less songs when no creator filter is supplied", async () => {
    respond([row([])], 1);
    const result = await selectCatalogSongsWithArtists({ catalogId: "catalog-fixture" });
    const query = sentQuery();
    const selection = query.get("select")!;
    expect(selection).toContain("song_artists(");
    expect(selection).toContain("accounts(");
    expect(selection).not.toContain("song_artists!inner");
    expect(selection).not.toContain("accounts!inner");
    expect(query.has("songs.song_artists.accounts.name")).toBe(false);
    expect(query.has("offset")).toBe(false);
    expect(result.total_count).toBe(1);
    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].artists).toEqual([]);
  });

  it("omits null account embeds while retaining valid collaborators", async () => {
    respond(
      [
        row([
          { artist: "missing", accounts: null },
          { artist: account.id, accounts: account },
        ]),
      ],
      1,
    );
    const result = await selectCatalogSongsWithArtists({});
    expect(result.songs[0].artists).toEqual([account]);
    expect(result.total_count).toBe(1);
  });

  it("returns an empty artists array for a missing artist relation", async () => {
    respond([row(null)], 1);
    const result = await selectCatalogSongsWithArtists({});
    expect(result.songs[0].artists).toEqual([]);
  });

  it("propagates query failures rather than presenting an empty successful catalog", async () => {
    fixtureFetch.mockResolvedValue(
      new Response(JSON.stringify({ message: "fixture query failure" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(selectCatalogSongsWithArtists({})).rejects.toThrow(
      "Failed to fetch catalog songs: fixture query failure",
    );
  });
});
