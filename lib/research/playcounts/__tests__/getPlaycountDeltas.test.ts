import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPlaycountDeltas } from "../getPlaycountDeltas";

import { selectSongs } from "@/lib/supabase/songs/selectSongs";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { deductCredits } from "@/lib/research/deductCredits";

vi.mock("@/lib/supabase/songs/selectSongs", () => ({ selectSongs: vi.fn() }));
vi.mock("@/lib/supabase/song_measurements/selectSongMeasurements", () => ({
  selectSongMeasurements: vi.fn(),
}));
vi.mock("@/lib/research/deductCredits", () => ({ deductCredits: vi.fn() }));

const ISRC = "USA2P2015959";

describe("getPlaycountDeltas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selectSongs).mockResolvedValue([{ isrc: ISRC, name: "The Spins" }] as never);
  });

  it("returns per-platform deltas for a known ISRC", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([
      {
        song: ISRC,
        platform: "spotify",
        metric: "platform_displayed_play_count",
        value: 1365000000,
        captured_at: "2026-07-09T07:00:00Z",
        data_source: "apify_spotify_playcount",
      },
      {
        song: ISRC,
        platform: "spotify",
        metric: "platform_displayed_play_count",
        value: 1331384578,
        captured_at: "2026-06-09T07:00:00Z",
        data_source: "apify_spotify_playcount",
      },
    ] as never);

    const result = await getPlaycountDeltas({
      accountId: "acc_1",
      isrc: ISRC,
      since: "2026-06-01",
    });

    expect(selectSongMeasurements).toHaveBeenCalledWith({ song: ISRC });
    expect(deductCredits).toHaveBeenCalledWith("acc_1");
    const data = (result as { data: { isrc: string; deltas: unknown[] } }).data;
    expect(data.isrc).toBe(ISRC);
    expect(data.deltas).toHaveLength(1);
  });

  it("returns an empty deltas array (not an error) when history is insufficient", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([]);

    const result = await getPlaycountDeltas({
      accountId: "acc_1",
      isrc: ISRC,
      since: "2026-06-01",
    });

    expect(result).toEqual({ data: { status: "success", isrc: ISRC, deltas: [] } });
  });

  it("returns 404 for an unknown ISRC", async () => {
    vi.mocked(selectSongs).mockResolvedValue([]);

    const result = await getPlaycountDeltas({
      accountId: "acc_1",
      isrc: "ZZZZZ",
      since: "2026-06-01",
    });

    expect(result).toEqual({ error: "Unknown ISRC", status: 404 });
    expect(deductCredits).not.toHaveBeenCalled();
  });
});
