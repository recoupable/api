import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

import { getResearchMetricsHandler } from "../getResearchMetricsHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveArtist } from "@/lib/research/resolveArtist";
import { selectResearchCacheEntry } from "@/lib/supabase/research_cache_entries/selectResearchCacheEntry";
import { upsertResearchCacheEntry } from "@/lib/supabase/research_cache_entries/upsertResearchCacheEntry";
import { kickRefreshResearchCacheWorkflow } from "@/lib/research/cache/kickRefreshResearchCacheWorkflow";
import { fetchResearchProvider } from "@/lib/research/providers/fetchResearchProvider";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/research/ensureResearchCredits", () => ({
  ensureResearchCredits: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/research/resolveArtist", () => ({
  resolveArtist: vi.fn(),
}));

vi.mock("@/lib/supabase/research_cache_entries/selectResearchCacheEntry", () => ({
  selectResearchCacheEntry: vi.fn(),
}));

vi.mock("@/lib/supabase/research_cache_entries/upsertResearchCacheEntry", () => ({
  upsertResearchCacheEntry: vi.fn(),
}));

vi.mock("@/lib/research/cache/kickRefreshResearchCacheWorkflow", () => ({
  kickRefreshResearchCacheWorkflow: vi.fn(),
}));

vi.mock("@/lib/research/providers/fetchResearchProvider", () => ({
  fetchResearchProvider: vi.fn(),
}));

vi.mock("@/lib/credits/recordCreditDeduction", () => ({
  recordCreditDeduction: vi.fn(),
}));

function request(url: string) {
  return new NextRequest(url, { headers: { "x-api-key": "test" } });
}

function cacheRow(overrides: Record<string, unknown> = {}) {
  return {
    cache_key: "cache_1",
    provider: "songstats",
    endpoint: "artist_metrics",
    entity_type: "artist",
    entity_id: "artist_1",
    source: "spotify",
    query: {},
    data: { stats: [{ source: "spotify", data: { streams_total: 100 } }] },
    raw_data: { stats: [{ source: "spotify", data: { streams_total: 100 } }] },
    status: "ready",
    status_code: 200,
    error: null,
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    refresh_started_at: null,
    refresh_run_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("getResearchMetricsHandler cache behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account_1",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(resolveArtist).mockResolvedValue({ id: "artist_1" });
    vi.mocked(recordCreditDeduction).mockResolvedValue(undefined as never);
    vi.mocked(upsertResearchCacheEntry).mockResolvedValue(null as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns fresh cached metrics without calling the provider", async () => {
    vi.mocked(selectResearchCacheEntry).mockResolvedValue(cacheRow() as never);

    const res = await getResearchMetricsHandler(
      request("http://localhost/api/research/metrics?artist=Drake&source=spotify"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      status: "success",
      stats: [{ source: "spotify", data: { streams_total: 100 } }],
    });
    expect(fetchResearchProvider).not.toHaveBeenCalled();
    expect(kickRefreshResearchCacheWorkflow).not.toHaveBeenCalled();
    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "account_1",
      creditsToDeduct: 5,
      source: "api",
    });
  });

  it("returns stale cached metrics and queues a background refresh", async () => {
    vi.mocked(selectResearchCacheEntry).mockResolvedValue(
      cacheRow({
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      }) as never,
    );

    const res = await getResearchMetricsHandler(
      request("http://localhost/api/research/metrics?artist=Drake&source=spotify"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats).toEqual([{ source: "spotify", data: { streams_total: 100 } }]);
    expect(kickRefreshResearchCacheWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        cacheKey: expect.any(String),
        path: "/artist/artist_1/stat/spotify",
        provider: "songstats",
      }),
    );
    expect(fetchResearchProvider).not.toHaveBeenCalled();
  });

  it("returns 202 and queues a background refresh on cold miss", async () => {
    vi.mocked(selectResearchCacheEntry).mockResolvedValue(null as never);

    const res = await getResearchMetricsHandler(
      request("http://localhost/api/research/metrics?id=artist_1&source=spotify"),
    );
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body).toEqual({
      status: "pending",
      state: "refresh_pending",
      message: "Research metrics refresh is pending. Retry this endpoint shortly.",
    });
    expect(resolveArtist).not.toHaveBeenCalled();
    expect(kickRefreshResearchCacheWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        cacheKey: expect.any(String),
        entityId: "artist_1",
        path: "/artist/artist_1/stat/spotify",
        source: "spotify",
      }),
    );
    expect(recordCreditDeduction).not.toHaveBeenCalled();
  });

  it("uses direct metrics fetches for Chartmetric legacy provider mode", async () => {
    vi.stubEnv("RESEARCH_PROVIDER", "chartmetric");
    vi.mocked(fetchResearchProvider).mockResolvedValue({
      status: 200,
      data: { followers: [{ value: 100 }] },
    } as never);

    const res = await getResearchMetricsHandler(
      request("http://localhost/api/research/metrics?artist=Drake&source=spotify"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      status: "success",
      followers: [{ value: 100 }],
    });
    expect(selectResearchCacheEntry).not.toHaveBeenCalled();
    expect(kickRefreshResearchCacheWorkflow).not.toHaveBeenCalled();
    expect(fetchResearchProvider).toHaveBeenCalledWith("/artist/artist_1/stat/spotify", undefined);
  });
});
