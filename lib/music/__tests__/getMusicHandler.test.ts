import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getMusicHandler } from "../getMusicHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectMusicGenerations } from "@/lib/supabase/music_generations/selectMusicGenerations";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/music_generations/selectMusicGenerations", () => ({
  selectMusicGenerations: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";

const row = (over: Record<string, unknown> = {}) =>
  ({
    id: "11111111-2222-4333-8444-555555555555",
    account_id: accountId,
    status: "completed",
    model: "minimax/music-3",
    prompt: "p",
    lyrics: "l",
    duration_seconds: 60,
    fal_request_id: "req_1",
    workflow_run_id: null,
    storage_key: "music/abc.wav",
    error_message: null,
    created_at: "2026-08-21T12:00:00.000Z",
    updated_at: "2026-08-21T12:00:00.000Z",
    ...over,
  }) as never;

const request = (qs = "") => new NextRequest(`http://localhost/api/music${qs}`, { method: "GET" });

describe("getMusicHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "t",
    } as never);
    vi.mocked(selectMusicGenerations).mockResolvedValue([row()]);
  });

  it("returns the caller's generations newest first with the documented defaults", async () => {
    const res = await getMusicHandler(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(selectMusicGenerations).toHaveBeenCalledWith(
      expect.objectContaining({ accountId, limit: 20, offset: 0 }),
    );
    expect(body.status).toBe("success");
    expect(body.generations).toHaveLength(1);
  });

  it("never returns logs on the list, only on the single read", async () => {
    const body = await (await getMusicHandler(request())).json();

    expect(body.generations[0]).not.toHaveProperty("logs");
  });

  it("passes the status filter through", async () => {
    await getMusicHandler(request("?status=processing"));

    expect(selectMusicGenerations).toHaveBeenCalledWith(
      expect.objectContaining({ status: "processing" }),
    );
  });

  it("rejects an unknown status with 400", async () => {
    const res = await getMusicHandler(request("?status=banana"));

    expect(res.status).toBe(400);
    expect(selectMusicGenerations).not.toHaveBeenCalled();
  });

  it("rejects a limit above the documented maximum", async () => {
    const res = await getMusicHandler(request("?limit=51"));

    expect(res.status).toBe(400);
  });

  it("passes account_id through to the auth context as an override", async () => {
    const target = "660e8400-e29b-41d4-a716-446655440001";

    await getMusicHandler(request(`?account_id=${target}`));

    expect(validateAuthContext).toHaveBeenCalledWith(expect.anything(), { accountId: target });
  });

  it("returns the auth failure untouched", async () => {
    const authErr = NextResponse.json({ status: "error" }, { status: 403 });
    vi.mocked(validateAuthContext).mockResolvedValue(authErr as never);

    const res = await getMusicHandler(request());

    expect(res.status).toBe(403);
    expect(selectMusicGenerations).not.toHaveBeenCalled();
  });

  it("returns 500 when the read fails, never an empty list", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(selectMusicGenerations).mockRejectedValue(new Error("db down"));

    const res = await getMusicHandler(request());

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
