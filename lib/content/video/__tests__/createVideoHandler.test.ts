import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createVideoHandler } from "../createVideoHandler";
import { ensureVideoCredits } from "@/lib/content/ensureVideoCredits";
import { generateVideo } from "../generateVideo";
import { chargeForGeneration } from "@/lib/content/chargeForGeneration";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(async () => ({ accountId: "fixture-account" })),
}));
vi.mock("@/lib/content/ensureVideoCredits", () => ({
  ensureVideoCredits: vi.fn(async () => null),
}));
vi.mock("../generateVideo", () => ({
  HOUSE_VIDEO_MODEL: "minimax/h3-max/image-to-video",
  generateVideo: vi.fn(async () => ({
    videoUrl: "https://x.test/out.mp4",
    requestId: "fixture-request",
  })),
}));
vi.mock("@/lib/content/chargeForGeneration", () => ({ chargeForGeneration: vi.fn() }));

describe("video generation semantic validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    { audio_url: "https://x.test/song.mp3" },
    { mode: "lipsync" },
    { video_url: "https://x.test/existing.mp4" },
    { reference_image_url: "https://x.test/face.png" },
    { duration: "8" },
    { model: "arbitrary/model" },
  ])("rejects unsupported semantic input %j before credits/provider work", async extra => {
    const response = await createVideoHandler(
      new NextRequest("https://x.test/api/content/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "singing", ...extra }),
      }),
    );
    expect(response.status).toBe(400);
    expect(ensureVideoCredits).not.toHaveBeenCalled();
    expect(generateVideo).not.toHaveBeenCalled();
    expect(chargeForGeneration).not.toHaveBeenCalled();
  });
});
