import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertSongMeasurements } from "../upsertSongMeasurements";

import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return {
    default: { from: mockFrom },
  };
});

const ROWS = [
  {
    song: "USUYG1069896",
    platform: "spotify",
    metric: "platform_displayed_play_count",
    value: 1331384578,
    captured_at: "2026-06-10T00:00:00Z",
    data_source: "apify_spotify_playcount",
  },
  {
    song: "USUYG1069897",
    platform: "spotify",
    metric: "platform_displayed_play_count",
    value: 39849305,
    captured_at: "2026-06-10T00:00:00Z",
    data_source: "apify_spotify_playcount",
  },
];

describe("upsertSongMeasurements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts with ignoreDuplicates on the fetch-once unique key and returns rows", async () => {
    const select = vi.fn().mockResolvedValue({ data: ROWS, error: null });
    const upsert = vi.fn().mockReturnValue({ select });
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);

    const result = await upsertSongMeasurements(ROWS);

    expect(supabase.from).toHaveBeenCalledWith("song_measurements");
    expect(upsert).toHaveBeenCalledWith(ROWS, {
      onConflict: "song,platform,metric,captured_at",
      ignoreDuplicates: true,
    });
    expect(result).toEqual(ROWS);
  });

  it("throws on insert error", async () => {
    const select = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const upsert = vi.fn().mockReturnValue({ select });
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);

    await expect(upsertSongMeasurements(ROWS)).rejects.toThrow(
      "Failed to upsert song measurements: boom",
    );
  });

  it("returns [] without querying when given no rows", async () => {
    const result = await upsertSongMeasurements([]);

    expect(supabase.from).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
