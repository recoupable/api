import { beforeEach, describe, expect, it, vi } from "vitest";
import { waitForSnapshotMeasurements } from "@/lib/valuation/waitForSnapshotMeasurements";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";

vi.mock("@/lib/supabase/song_measurements/selectSongMeasurements", () => ({
  selectSongMeasurements: vi.fn(),
}));

const noSleep = () => Promise.resolve();

describe("waitForSnapshotMeasurements", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true as soon as a measurement lands", async () => {
    vi.mocked(selectSongMeasurements)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ song: "US123" }] as never);
    const ok = await waitForSnapshotMeasurements("snap-1", noSleep);
    expect(ok).toBe(true);
    expect(selectSongMeasurements).toHaveBeenCalledTimes(2);
    expect(selectSongMeasurements).toHaveBeenCalledWith({ snapshot: "snap-1", limit: 1 });
  });

  it("returns false when nothing lands within the bound", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([] as never);
    const ok = await waitForSnapshotMeasurements("snap-1", noSleep);
    expect(ok).toBe(false);
  });
});
