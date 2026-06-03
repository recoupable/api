import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchResearchProvider } from "../fetchResearchProvider";
import { fetchChartmetric } from "@/lib/chartmetric/fetchChartmetric";
import { fetchSongstatsResearch } from "@/lib/research/songstats/fetchSongstatsResearch";

vi.mock("@/lib/chartmetric/fetchChartmetric", () => ({
  fetchChartmetric: vi.fn(),
}));

vi.mock("@/lib/research/songstats/fetchSongstatsResearch", () => ({
  fetchSongstatsResearch: vi.fn(),
}));

const ORIGINAL_PROVIDER = process.env.RESEARCH_PROVIDER;

describe("fetchResearchProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.RESEARCH_PROVIDER = ORIGINAL_PROVIDER;
  });

  it("uses SongStats research by default", async () => {
    delete process.env.RESEARCH_PROVIDER;
    vi.mocked(fetchSongstatsResearch).mockResolvedValue({ status: 200, data: { ok: true } });

    const result = await fetchResearchProvider("/search", { q: "Drake" });

    expect(result).toEqual({ status: 200, data: { ok: true } });
    expect(fetchSongstatsResearch).toHaveBeenCalledWith("/search", { q: "Drake" });
    expect(fetchChartmetric).not.toHaveBeenCalled();
  });

  it("uses Chartmetric when configured as the legacy provider", async () => {
    process.env.RESEARCH_PROVIDER = "chartmetric";
    vi.mocked(fetchChartmetric).mockResolvedValue({ status: 200, data: { legacy: true } });

    const result = await fetchResearchProvider("/search", { q: "Drake" });

    expect(result).toEqual({ status: 200, data: { legacy: true } });
    expect(fetchChartmetric).toHaveBeenCalledWith("/search", { q: "Drake" });
    expect(fetchSongstatsResearch).not.toHaveBeenCalled();
  });
});
