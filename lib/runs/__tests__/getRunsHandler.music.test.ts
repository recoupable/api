import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getRunsHandler } from "../getRunsHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import { selectMusicGenerations } from "@/lib/supabase/music_generations/selectMusicGenerations";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots", () => ({
  selectPlaycountSnapshots: vi.fn(),
}));
vi.mock("@/lib/supabase/music_generations/selectMusicGenerations", () => ({
  selectMusicGenerations: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const generationId = "11111111-2222-4333-8444-555555555555";

const makeRequest = (qs: string) =>
  new NextRequest(`http://localhost/api/runs${qs}`, { method: "GET" });

const generation = (over: Record<string, unknown> = {}) =>
  ({
    id: generationId,
    account_id: accountId,
    status: "processing",
    storage_key: null,
    source_url: null,
    created_at: "2026-08-21T12:00:00.000Z",
    ...over,
  }) as never;

describe("getRunsHandler with kind=music", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "t",
    } as never);
    vi.mocked(selectMusicGenerations).mockResolvedValue([generation()]);
  });

  it("returns music generations as runs", async () => {
    const res = await getRunsHandler(makeRequest("?kind=music"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0]).toMatchObject({
      id: generationId,
      kind: "music",
      state: "generating",
    });
  });

  it("reads generations rather than snapshots for this kind", async () => {
    await getRunsHandler(makeRequest("?kind=music&limit=5"));

    expect(selectMusicGenerations).toHaveBeenCalledWith({ accountId, limit: 5 });
    expect(selectPlaycountSnapshots).not.toHaveBeenCalled();
  });

  it("leaves the valuation kind reading snapshots", async () => {
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([]);

    await getRunsHandler(makeRequest("?kind=valuation"));

    expect(selectPlaycountSnapshots).toHaveBeenCalled();
    expect(selectMusicGenerations).not.toHaveBeenCalled();
  });

  it("still rejects an unknown kind", async () => {
    const res = await getRunsHandler(makeRequest("?kind=banana"));

    expect(res.status).toBe(400);
  });
});
