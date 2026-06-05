import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchResearchProvider } from "../fetchResearchProvider";
import { fetchSongstatsResearch } from "@/lib/research/songstats/fetchSongstatsResearch";

vi.mock("@/lib/research/songstats/fetchSongstatsResearch", () => ({
  fetchSongstatsResearch: vi.fn(),
}));

describe("fetchResearchProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to SongStats research", async () => {
    vi.mocked(fetchSongstatsResearch).mockResolvedValue({ status: 200, data: { ok: true } });

    const result = await fetchResearchProvider("/search", { q: "Drake" });

    expect(result).toEqual({ status: 200, data: { ok: true } });
    expect(fetchSongstatsResearch).toHaveBeenCalledWith("/search", { q: "Drake" });
  });
});
