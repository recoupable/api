import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getMusicGenerationHandler } from "../getMusicGenerationHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectMusicGenerations } from "@/lib/supabase/music_generations/selectMusicGenerations";
import { fetchMusicLogs } from "../fetchMusicLogs";
import { fetchMusicSeed } from "../fetchMusicSeed";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/music_generations/selectMusicGenerations", () => ({
  selectMusicGenerations: vi.fn(),
}));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("../fetchMusicLogs", () => ({ fetchMusicLogs: vi.fn() }));
vi.mock("../fetchMusicSeed", () => ({ fetchMusicSeed: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const strangerId = "770e8400-e29b-41d4-a716-446655440002";
const generationId = "11111111-2222-4333-8444-555555555555";

const row = (over: Record<string, unknown> = {}) =>
  ({
    id: generationId,
    account_id: accountId,
    status: "processing",
    model: "minimax/music-3",
    prompt: "p",
    lyrics: "l",
    duration_seconds: null,
    fal_request_id: "req_1",
    workflow_run_id: null,
    storage_key: null,
    error_message: null,
    created_at: "2026-08-21T12:00:00.000Z",
    updated_at: "2026-08-21T12:00:00.000Z",
    ...over,
  }) as never;

const request = () =>
  new NextRequest(`http://localhost/api/music/${generationId}`, { method: "GET" });

describe("getMusicGenerationHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "t",
    } as never);
    vi.mocked(selectMusicGenerations).mockResolvedValue([row()]);
    vi.mocked(canAccessAccount).mockResolvedValue(true as never);
    vi.mocked(fetchMusicLogs).mockResolvedValue([]);
    vi.mocked(fetchMusicSeed).mockResolvedValue(null);
  });

  it("returns the generation with a timeline read live from fal", async () => {
    vi.mocked(fetchMusicLogs).mockResolvedValue([{ at: "t1", message: "0/180" }]);

    const res = await getMusicGenerationHandler(request(), generationId);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.generation.id).toBe(generationId);
    // Sourced from fal via the stored request id, never from a column.
    expect(fetchMusicLogs).toHaveBeenCalledWith("req_1");
    expect(body.generation.logs).toEqual([{ at: "t1", message: "0/180" }]);
  });

  it("still returns the generation when fal has no timeline to give", async () => {
    vi.mocked(fetchMusicLogs).mockResolvedValue([]);

    const res = await getMusicGenerationHandler(request(), generationId);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.generation.logs).toEqual([]);
  });

  it("does not ask fal for logs on a generation that never reached it", async () => {
    vi.mocked(selectMusicGenerations).mockResolvedValue([row({ fal_request_id: null })]);

    const res = await getMusicGenerationHandler(request(), generationId);

    expect(res.status).toBe(200);
    expect(fetchMusicLogs).toHaveBeenCalledWith(null);
  });

  it("404s an unknown generation", async () => {
    vi.mocked(selectMusicGenerations).mockResolvedValue([]);

    const res = await getMusicGenerationHandler(request(), generationId);

    expect(res.status).toBe(404);
  });

  it("400s a generationId that is not a uuid", async () => {
    const res = await getMusicGenerationHandler(request(), "not-a-uuid");

    expect(res.status).toBe(400);
    expect(selectMusicGenerations).not.toHaveBeenCalled();
  });

  it("403s a caller who cannot reach the owning account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: strangerId,
      orgId: null,
      authToken: "t",
    } as never);
    vi.mocked(canAccessAccount).mockResolvedValue(false as never);

    const res = await getMusicGenerationHandler(request(), generationId);

    expect(res.status).toBe(403);
  });

  it("lets an organization key reach a member account's generation", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: strangerId,
      orgId: "org-1",
      authToken: "t",
    } as never);
    vi.mocked(canAccessAccount).mockResolvedValue(true as never);
    vi.mocked(fetchMusicLogs).mockResolvedValue([]);

    const res = await getMusicGenerationHandler(request(), generationId);

    expect(res.status).toBe(200);
  });

  it("returns the seed fal used, read live off the finished result", async () => {
    vi.mocked(selectMusicGenerations).mockResolvedValue([row({ status: "completed" })]);
    vi.mocked(fetchMusicSeed).mockResolvedValue(42);

    const res = await getMusicGenerationHandler(request(), generationId);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(fetchMusicSeed).toHaveBeenCalledWith("req_1", "completed");
    expect(body.generation.seed).toBe(42);
  });

  it("reports a null seed rather than omitting the field while rendering", async () => {
    vi.mocked(fetchMusicSeed).mockResolvedValue(null);

    const res = await getMusicGenerationHandler(request(), generationId);
    const body = await res.json();

    expect(body.generation).toHaveProperty("seed", null);
  });

  it("returns 500 when the read fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(selectMusicGenerations).mockRejectedValue(new Error("db down"));

    const res = await getMusicGenerationHandler(request(), generationId);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
