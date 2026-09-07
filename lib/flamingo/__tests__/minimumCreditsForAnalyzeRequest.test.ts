import { describe, it, expect } from "vitest";
import { minimumCreditsForAnalyzeRequest } from "../minimumCreditsForAnalyzeRequest";
import { FULL_REPORT_SECTIONS } from "@/lib/flamingo/presets/fullReport";

describe("minimumCreditsForAnalyzeRequest", () => {
  // The gate asks for the least the request can possibly cost: one base fee per
  // model call. It never tries to guess elapsed seconds up front.
  it("requires one base fee for a custom prompt", () => {
    expect(minimumCreditsForAnalyzeRequest({ prompt: "What key is this in?" })).toBe(50_000);
  });

  it("requires one base fee for a single preset", () => {
    expect(
      minimumCreditsForAnalyzeRequest({
        preset: "mood_tags",
        audio_url: "https://example.com/song.mp3",
      }),
    ).toBe(50_000);
  });

  it("requires one base fee per section for full_report", () => {
    expect(FULL_REPORT_SECTIONS).toHaveLength(13);
    expect(
      minimumCreditsForAnalyzeRequest({
        preset: "full_report",
        audio_url: "https://example.com/song.mp3",
      }),
    ).toBe(650_000);
  });
});
