import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertSongIdentifiers } from "../upsertSongIdentifiers";

import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return { default: { from: mockFrom } };
});

const ROWS = [
  { song: "ISRC1", platform: "spotify", identifier_type: "track_id", value: "t1" },
  { song: "ISRC1", platform: "spotify", identifier_type: "album_id", value: "a1" },
];

describe("upsertSongIdentifiers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts mappings, ignoring existing (an external id maps once)", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);

    await upsertSongIdentifiers(ROWS);

    expect(supabase.from).toHaveBeenCalledWith("song_identifiers");
    expect(upsert).toHaveBeenCalledWith(ROWS, {
      onConflict: "platform,identifier_type,value",
      ignoreDuplicates: true,
    });
  });

  it("skips the query for empty input", async () => {
    await upsertSongIdentifiers([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("throws on error (mappings are load-bearing)", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);

    await expect(upsertSongIdentifiers(ROWS)).rejects.toThrow(
      "Failed to upsert song identifiers: boom",
    );
  });
});
