import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectLatestSongMeasurement } from "../selectLatestSongMeasurement";

import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return {
    default: { from: mockFrom },
  };
});

describe("selectLatestSongMeasurement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the most recent measurement for (song, platform, metric)", async () => {
    const row = {
      song: "USUYG1069896",
      platform: "spotify",
      metric: "platform_displayed_play_count",
      value: 1331384578,
      captured_at: "2026-06-09T00:00:00Z",
      data_source: "apify_spotify_playcount",
    };
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const eq3 = vi.fn().mockReturnValue({ order });
    const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eq1 }),
    } as never);

    const result = await selectLatestSongMeasurement(
      "USUYG1069896",
      "spotify",
      "platform_displayed_play_count",
    );

    expect(supabase.from).toHaveBeenCalledWith("song_measurements");
    expect(order).toHaveBeenCalledWith("captured_at", { ascending: false });
    expect(result).toEqual(row);
  });

  it("returns null when no measurement exists", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const eq3 = vi.fn().mockReturnValue({ order });
    const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eq1 }),
    } as never);

    const result = await selectLatestSongMeasurement("UNKNOWN", "spotify", "x");

    expect(result).toBeNull();
  });

  it("returns null on query error", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const eq3 = vi.fn().mockReturnValue({ order });
    const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eq1 }),
    } as never);

    const result = await selectLatestSongMeasurement("USUYG1069896", "spotify", "x");

    expect(result).toBeNull();
  });
});
