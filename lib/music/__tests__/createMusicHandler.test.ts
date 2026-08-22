import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createMusicHandler } from "../createMusicHandler";
import { validateCreateMusicBody } from "../validateCreateMusicBody";
import { ensureMusicCredits } from "../ensureMusicCredits";
import { startMusicGeneration } from "../startMusicGeneration";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("../validateCreateMusicBody", () => ({ validateCreateMusicBody: vi.fn() }));
vi.mock("../ensureMusicCredits", () => ({ ensureMusicCredits: vi.fn() }));
vi.mock("../startMusicGeneration", () => ({ startMusicGeneration: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const generationId = "11111111-2222-3333-4444-555555555555";

const request = () => new NextRequest("http://localhost/api/music", { method: "POST" });

const validated = {
  accountId,
  organizationId: null,
  prompt: "Genre: acoustic pop.",
  lyrics: "[verse]\nMorning light",
  duration: 60,
  num_inference_steps: 30,
  guidance_scale: 1.7,
};

const generation = {
  id: generationId,
  status: "pending",
  prompt: validated.prompt,
  lyrics: validated.lyrics,
  created_at: "2026-08-21T12:00:00.000Z",
};

describe("createMusicHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCreateMusicBody).mockResolvedValue(validated as never);
    vi.mocked(ensureMusicCredits).mockResolvedValue(null);
    vi.mocked(startMusicGeneration).mockResolvedValue(generation as never);
  });

  it("accepts the generation with 202 and a Location header", async () => {
    const res = await createMusicHandler(request());
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(res.headers.get("Location")).toBe(`/api/music/${generationId}`);
    expect(body).toMatchObject({ status: "success", generation: { id: generationId } });
  });

  it("charges the duration-derived cost, not a flat fee", async () => {
    await createMusicHandler(request());

    expect(ensureMusicCredits).toHaveBeenCalledWith(accountId, 60);
  });

  it("returns the validation failure without touching credits or fal", async () => {
    const bad = NextResponse.json({ status: "error" }, { status: 400 });
    vi.mocked(validateCreateMusicBody).mockResolvedValue(bad as never);

    const res = await createMusicHandler(request());

    expect(res.status).toBe(400);
    expect(ensureMusicCredits).not.toHaveBeenCalled();
    expect(startMusicGeneration).not.toHaveBeenCalled();
  });

  it("returns 402 and never starts a generation when credits are short", async () => {
    const short = NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
    vi.mocked(ensureMusicCredits).mockResolvedValue(short);

    const res = await createMusicHandler(request());

    expect(res.status).toBe(402);
    expect(startMusicGeneration).not.toHaveBeenCalled();
  });

  it("returns 500 when the generation cannot be started", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(startMusicGeneration).mockRejectedValue(new Error("db down"));

    const res = await createMusicHandler(request());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.status).toBe("error");
    consoleSpy.mockRestore();
  });
});
