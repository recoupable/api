import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveTrackIsrc } from "../resolveTrackIsrc";
import { selectSongIdentifiers } from "@/lib/supabase/song_identifiers/selectSongIdentifiers";

vi.mock("@/lib/supabase/song_identifiers/selectSongIdentifiers", () => ({
  selectSongIdentifiers: vi.fn(),
}));

describe("resolveTrackIsrc", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an ISRC-shaped id unchanged without a lookup", async () => {
    const out = await resolveTrackIsrc("USQY51771120");
    expect(out).toBe("USQY51771120");
    expect(selectSongIdentifiers).not.toHaveBeenCalled();
  });

  it("resolves a Spotify track id to its ISRC via the identifier mappings", async () => {
    vi.mocked(selectSongIdentifiers).mockResolvedValue([
      { song: "USQY51771120", platform: "spotify", identifier_type: "track_id", value: "6Rmabc" },
    ]);
    const out = await resolveTrackIsrc("6Rmabc");
    expect(selectSongIdentifiers).toHaveBeenCalledWith({
      platform: "spotify",
      identifierType: "track_id",
      values: ["6Rmabc"],
    });
    expect(out).toBe("USQY51771120");
  });

  it("returns null when a non-ISRC id maps to nothing", async () => {
    vi.mocked(selectSongIdentifiers).mockResolvedValue([]);
    // a 22-char Spotify-style id (not ISRC-shaped) that has no mapping
    expect(await resolveTrackIsrc("6rqhFgbbKwnb9MLmUQDhG6")).toBeNull();
  });
});
