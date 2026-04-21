import { describe, it, expect, vi, beforeEach } from "vitest";

import { selectSongsWithArtists } from "../selectSongsWithArtists";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

describe("selectSongsWithArtists", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEq });
  });

  it("queries songs with the embed and orders by updated_at desc", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    await selectSongsWithArtists({});

    expect(mockFrom).toHaveBeenCalledWith("songs");
    const selectArg = mockSelect.mock.calls[0][0] as string;
    expect(selectArg).toContain("isrc");
    expect(selectArg).toContain("song_artists");
    expect(selectArg).toContain("accounts!inner");
    expect(mockOrder).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(mockEq).not.toHaveBeenCalled();
  });

  it("filters by isrc when provided", async () => {
    mockEq.mockResolvedValue({ data: [], error: null });

    await selectSongsWithArtists({ isrc: "USRC17607839" });

    expect(mockEq).toHaveBeenCalledWith("isrc", "USRC17607839");
  });

  it("filters by artist_account_id via song_artists.artist when provided", async () => {
    mockEq.mockResolvedValue({ data: [], error: null });

    await selectSongsWithArtists({ artist_account_id: VALID_UUID });

    expect(mockEq).toHaveBeenCalledWith("song_artists.artist", VALID_UUID);
  });

  it("flattens song_artists[].accounts into a top-level artists[] per song", async () => {
    const raw = [
      {
        isrc: "USRC17607839",
        name: "Song A",
        album: "Album A",
        notes: null,
        updated_at: "2024-01-02T00:00:00Z",
        song_artists: [
          { artist: VALID_UUID, accounts: { id: VALID_UUID, name: "Artist", timestamp: "t" } },
        ],
      },
    ];
    mockEq.mockResolvedValue({ data: raw, error: null });

    const result = await selectSongsWithArtists({ isrc: "USRC17607839" });

    expect(result).toEqual([
      {
        isrc: "USRC17607839",
        name: "Song A",
        album: "Album A",
        notes: null,
        updated_at: "2024-01-02T00:00:00Z",
        artists: [{ id: VALID_UUID, name: "Artist", timestamp: "t" }],
      },
    ]);
  });

  it("throws a wrapped error when Supabase returns an error", async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(selectSongsWithArtists({})).rejects.toThrow(/Failed to fetch songs/);
  });
});
