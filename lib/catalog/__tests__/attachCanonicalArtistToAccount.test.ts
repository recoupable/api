import { describe, it, expect, vi, beforeEach } from "vitest";

import { attachCanonicalArtistToAccount } from "../attachCanonicalArtistToAccount";
import { selectSongArtists } from "@/lib/supabase/song_artists/selectSongArtists";
import { selectAccountArtistId } from "@/lib/supabase/account_artist_ids/selectAccountArtistId";
import { insertAccountArtistId } from "@/lib/supabase/account_artist_ids/insertAccountArtistId";

vi.mock("@/lib/supabase/song_artists/selectSongArtists", () => ({
  selectSongArtists: vi.fn(),
}));
vi.mock("@/lib/supabase/account_artist_ids/selectAccountArtistId", () => ({
  selectAccountArtistId: vi.fn(),
}));
vi.mock("@/lib/supabase/account_artist_ids/insertAccountArtistId", () => ({
  insertAccountArtistId: vi.fn(),
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
    vi.mocked(selectAccountArtistId).mockResolvedValue(null);

    const result = await attachCanonicalArtistToAccount({ accountId, isrcs: ["A", "B"] });

    expect(selectSongArtists).toHaveBeenCalledWith({ songs: ["A", "B"] });
    expect(insertAccountArtistId).toHaveBeenCalledWith(accountId, canonicalId);
    expect(result).toBe(canonicalId);
  });

  it("does not insert when the account already has the canonical artist", async () => {
    vi.mocked(selectSongArtists).mockResolvedValue([link("A", canonicalId)]);
    vi.mocked(selectAccountArtistId).mockResolvedValue({
      id: "existing",
      artist_id: canonicalId,
      pinned: false,
    });

    const result = await attachCanonicalArtistToAccount({ accountId, isrcs: ["A"] });

    expect(insertAccountArtistId).not.toHaveBeenCalled();
    expect(result).toBe(canonicalId);
  });

  it("no-ops when the songs have no artist links yet", async () => {
    vi.mocked(selectSongArtists).mockResolvedValue([]);

    const result = await attachCanonicalArtistToAccount({ accountId, isrcs: ["A"] });

    expect(selectAccountArtistId).not.toHaveBeenCalled();
    expect(insertAccountArtistId).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("no-ops when there are no ISRCs", async () => {
    const result = await attachCanonicalArtistToAccount({ accountId, isrcs: [] });

    expect(selectSongArtists).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("never throws: a failed attach must not fail the claim", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(selectSongArtists).mockResolvedValue([link("A", canonicalId)]);
    vi.mocked(selectAccountArtistId).mockResolvedValue(null);
    vi.mocked(insertAccountArtistId).mockRejectedValue(new Error("insert failed"));

    const result = await attachCanonicalArtistToAccount({ accountId, isrcs: ["A"] });

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
