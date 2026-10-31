import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createLipsyncHandler } from "../createLipsyncHandler";
import fal from "@/lib/fal/server";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { consumeOAuthRateLimit } from "@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit";
import { chargeForGeneration } from "@/lib/content/chargeForGeneration";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(async () => ({ accountId: "fixture-account" })),
}));
vi.mock("@/lib/fal/server", () => ({ default: { subscribe: vi.fn() } }));
vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn(),
}));
vi.mock("@/lib/content/chargeForGeneration", () => ({ chargeForGeneration: vi.fn() }));

vi.mock("@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit", () => ({
  consumeOAuthRateLimit: vi.fn(),
}));

const valid = {
  prompt: "The artist sings the supplied song",
  image_url: "https://x.test/artist.png",
  audio_url: "https://x.test/selected-clip.mp3",
  duration: 15,
};
const request = (body: unknown) =>
  new NextRequest("https://x.test/api/content/lipsync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("hosted lipsync generation boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(consumeOAuthRateLimit).mockResolvedValue(0);
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(null);
    vi.mocked(fal.subscribe).mockResolvedValue({
      data: { video: { url: "https://x.test/audio-driven.mp4" } },
      requestId: "fixture-generation",
    } as never);
  });

  it("preserves selected audio and uses the existing fixed LTX model with bounded output and model-specific billing", async () => {
    const response = await createLipsyncHandler(request(valid));
    expect(response.status).toBe(200);
    expect(consumeOAuthRateLimit).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/), [
      { key: expect.stringMatching(/^[a-f0-9]{64}$/), limit: 30 },
    ]);
    expect(fal.subscribe).toHaveBeenCalledWith("fal-ai/ltx-2-19b/audio-to-video", {
      input: expect.objectContaining({
        prompt: valid.prompt,
        image_url: valid.image_url,
        audio_url: valid.audio_url,
        match_audio_length: false,
        num_frames: 377,
        fps: 25,
        video_size: { width: 1280, height: 720 },
        audio_strength: 1,
      }),
    });
    expect(ensureCreditsOrShortCircuit).toHaveBeenCalledWith({
      accountId: "fixture-account",
      creditsToDeduct: 626400,
    });
    const charge = vi.mocked(chargeForGeneration).mock.calls[0][0];
    expect(charge).toMatchObject({
      endpointId: "fal-ai/ltx-2-19b/audio-to-video",
      requestId: "fixture-generation",
      fallbackUnits: 348,
    });
    expect(charge.creditsForUnits(100)).toBe(180000);
    expect(await response.json()).toEqual({ videoUrl: "https://x.test/audio-driven.mp4" });
  });

  it.each([
    { ...valid, audio_url: undefined },
    { ...valid, duration: 20 },
    { ...valid, duration: "15" },
    { ...valid, model: "caller/model" },
    { ...valid, num_frames: 5000 },
  ])("rejects unsafe or incomplete inputs before any billable work: %j", async body => {
    expect((await createLipsyncHandler(request(body))).status).toBe(400);
    expect(ensureCreditsOrShortCircuit).not.toHaveBeenCalled();
    expect(fal.subscribe).not.toHaveBeenCalled();
    expect(chargeForGeneration).not.toHaveBeenCalled();
  });

  it("short-circuits generation when credits are insufficient", async () => {
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(
      NextResponse.json({ error: "insufficient_credits" }, { status: 402 }),
    );
    expect((await createLipsyncHandler(request(valid))).status).toBe(402);
    expect(fal.subscribe).not.toHaveBeenCalled();
  });

  it("limits repeated account generations before provider spend", async () => {
    vi.mocked(consumeOAuthRateLimit).mockResolvedValue(12);
    const response = await createLipsyncHandler(request(valid));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
    expect(fal.subscribe).not.toHaveBeenCalled();
    expect(chargeForGeneration).not.toHaveBeenCalled();
  });

  it("fails closed when the shared limiter is unavailable", async () => {
    vi.mocked(consumeOAuthRateLimit).mockRejectedValue(new Error("database unavailable"));
    expect((await createLipsyncHandler(request(valid))).status).toBe(503);
    expect(fal.subscribe).not.toHaveBeenCalled();
  });

  it("does not charge for a provider response without video", async () => {
    vi.mocked(fal.subscribe).mockResolvedValue({ data: {}, requestId: "empty" } as never);
    expect((await createLipsyncHandler(request(valid))).status).toBe(502);
    expect(chargeForGeneration).not.toHaveBeenCalled();
  });
});
