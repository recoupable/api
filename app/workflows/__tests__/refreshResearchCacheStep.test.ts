import { describe, it, expect, vi, beforeEach } from "vitest";

import { refreshResearchCacheStep } from "../refreshResearchCacheStep";
import { fetchResearchProvider } from "@/lib/research/providers/fetchResearchProvider";
import { upsertResearchCacheEntry } from "@/lib/supabase/research_cache_entries/upsertResearchCacheEntry";

vi.mock("@/lib/research/providers/fetchResearchProvider", () => ({
  fetchResearchProvider: vi.fn(),
}));

vi.mock("@/lib/supabase/research_cache_entries/upsertResearchCacheEntry", () => ({
  upsertResearchCacheEntry: vi.fn(),
}));

describe("refreshResearchCacheStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("stores successful provider responses as ready cache entries", async () => {
    vi.mocked(fetchResearchProvider).mockResolvedValue({
      status: 200,
      data: { stats: [{ source: "spotify" }] },
    });

    await refreshResearchCacheStep({
      cacheKey: "cache_1",
      provider: "songstats",
      endpoint: "artist_metrics",
      entityType: "artist",
      entityId: "artist_1",
      source: "spotify",
      query: {},
      path: "/artist/artist_1/stat/spotify",
    });

    expect(fetchResearchProvider).toHaveBeenCalledWith("/artist/artist_1/stat/spotify", {});
    expect(upsertResearchCacheEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        cache_key: "cache_1",
        provider: "songstats",
        endpoint: "artist_metrics",
        entity_type: "artist",
        entity_id: "artist_1",
        source: "spotify",
        data: { stats: [{ source: "spotify" }] },
        raw_data: { stats: [{ source: "spotify" }] },
        status: "ready",
        status_code: 200,
        error: null,
        refresh_started_at: null,
      }),
    );
  });

  it("records failed refreshes without clearing cached data", async () => {
    vi.mocked(fetchResearchProvider).mockResolvedValue({ status: 504, data: null });

    await refreshResearchCacheStep({
      cacheKey: "cache_1",
      provider: "songstats",
      endpoint: "artist_metrics",
      entityType: "artist",
      entityId: "artist_1",
      source: "spotify",
      query: {},
      path: "/artist/artist_1/stat/spotify",
    });

    expect(upsertResearchCacheEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        cache_key: "cache_1",
        status: "failed",
        status_code: 504,
        error: "Request failed with status 504",
        refresh_started_at: null,
      }),
    );
    expect(vi.mocked(upsertResearchCacheEntry).mock.calls[0][0]).not.toHaveProperty("data");
  });
});
