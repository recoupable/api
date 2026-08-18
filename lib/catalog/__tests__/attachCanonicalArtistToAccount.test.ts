import { describe, it, expect, vi, beforeEach } from "vitest";

import { attachCanonicalArtistToAccount } from "../attachCanonicalArtistToAccount";
import { selectSongArtists } from "@/lib/supabase/song_artists/selectSongArtists";
import { upsertAccountArtistId } from "@/lib/supabase/account_artist_ids/upsertAccountArtistId";

vi.mock("@/lib/supabase/song_artists/selectSongArtists", () => ({
  selectSongArtists: vi.fn(),
}));
vi.mock("@/lib/supabase/account_artist_ids/upsertAccountArtistId", () => ({
  upsertAccountArtistId: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const canonicalId = "7647f901-a640-434c-b9c9-a18682435092";
const link = (song: string, artist: string) => ({ song, artist }) as never;

describe("attachCanonicalArtistToAccount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves the dominant artist through song_artists and links it to the account", async () => {
    vi.mocked(selectSongArtists).mockResolvedValue([
      link("A", canonicalId),
      link("B", canonicalId),
      link("B", "collab-1"),
    ]);

    const result = await attachCanonicalArtistToAccount({ accountId, isrcs: ["A", "B"] });

    expect(selectSongArtists).toHaveBeenCalledWith({ songs: ["A", "B"] });
    expect(upsertAccountArtistId).toHaveBeenCalledWith(accountId, canonicalId);
    expect(result).toBe(canonicalId);
  });

  it("no-ops when the songs have no artist links yet", async () => {
    vi.mocked(selectSongArtists).mockResolvedValue([]);

    const result = await attachCanonicalArtistToAccount({ accountId, isrcs: ["A"] });

    expect(upsertAccountArtistId).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("no-ops when there are no ISRCs", async () => {
    const result = await attachCanonicalArtistToAccount({ accountId, isrcs: [] });

    expect(selectSongArtists).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  // Whether a failed attach may fail the surrounding operation is the calling
  // surface's decision, not this helper's — swallowing here is what made the
  // 2026-08-18 empty-roster incident invisible (chat#1965).
  it("propagates a link failure to the caller", async () => {
    vi.mocked(selectSongArtists).mockResolvedValue([link("A", canonicalId)]);
    vi.mocked(upsertAccountArtistId).mockRejectedValue(new Error("insert failed"));

    await expect(attachCanonicalArtistToAccount({ accountId, isrcs: ["A"] })).rejects.toThrow(
      "insert failed",
    );
  });

  it("propagates a song-graph query failure to the caller", async () => {
    vi.mocked(selectSongArtists).mockRejectedValue(new Error("query failed"));

    await expect(attachCanonicalArtistToAccount({ accountId, isrcs: ["A"] })).rejects.toThrow(
      "query failed",
    );
  });
});
