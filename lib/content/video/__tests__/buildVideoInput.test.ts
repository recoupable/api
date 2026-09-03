import { describe, it, expect } from "vitest";
import { buildVideoInput } from "@/lib/content/video/buildVideoInput";
import type { ValidatedCreateVideoBody } from "@/lib/content/video/validateCreateVideoBody";

const base: ValidatedCreateVideoBody = {
  accountId: "acc-1",
  prompt: "a calm ocean",
  prompt_expansion_mode: "balanced",
  duration: 5,
  resolution: "768P",
  enable_safety_checker: true,
  sync_mode: false,
};

describe("buildVideoInput", () => {
  it("sends only H3 Max's real fields for a text-to-video request", () => {
    expect(buildVideoInput(base)).toEqual({
      prompt: "a calm ocean",
      prompt_expansion_mode: "balanced",
      duration: 5,
      resolution: "768P",
      enable_safety_checker: true,
      sync_mode: false,
    });
  });

  it("includes image_url and end_image_url only when provided", () => {
    const input = buildVideoInput({
      ...base,
      image_url: "https://example.com/start.png",
      end_image_url: "https://example.com/end.png",
    });
    expect(input.image_url).toBe("https://example.com/start.png");
    expect(input.end_image_url).toBe("https://example.com/end.png");
  });

  it("includes seed only when provided", () => {
    expect("seed" in buildVideoInput(base)).toBe(false);
    expect(buildVideoInput({ ...base, seed: 123 }).seed).toBe(123);
  });

  it("never sends aspect_ratio, video_url, audio_url, or negative_prompt — not H3 Max params", () => {
    const input = buildVideoInput(base);
    for (const key of ["aspect_ratio", "video_url", "audio_url", "negative_prompt"]) {
      expect(key in input).toBe(false);
    }
  });
});
