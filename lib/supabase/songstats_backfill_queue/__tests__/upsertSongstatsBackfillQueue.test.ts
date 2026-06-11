import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertSongstatsBackfillQueue } from "../upsertSongstatsBackfillQueue";

import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return {
    default: { from: mockFrom },
  };
});

describe("upsertSongstatsBackfillQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts a queue row by song, ignoring duplicates (existing rank/status win)", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);

    await upsertSongstatsBackfillQueue({ song: "USA2P2015959", rank_score: 1332534384 });

    expect(supabase.from).toHaveBeenCalledWith("songstats_backfill_queue");
    expect(upsert).toHaveBeenCalledWith([{ song: "USA2P2015959", rank_score: 1332534384 }], {
      onConflict: "song",
      ignoreDuplicates: true,
    });
  });

  it("logs and swallows insert errors (enqueue must never fail a read)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const upsert = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);

    await expect(
      upsertSongstatsBackfillQueue({ song: "USA2P2015959", rank_score: 0 }),
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
