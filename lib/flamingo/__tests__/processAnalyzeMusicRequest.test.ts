import { describe, it, expect, vi, beforeEach } from "vitest";
import { processAnalyzeMusicRequest } from "../processAnalyzeMusicRequest";

const mockCallFlamingoGenerate = vi.fn();
const mockGetPreset = vi.fn();
const mockExecuteFullReport = vi.fn();

vi.mock("@/lib/flamingo/callFlamingoGenerate", () => ({
  callFlamingoGenerate: (...args: unknown[]) => mockCallFlamingoGenerate(...args),
}));

vi.mock("@/lib/flamingo/presets", () => ({
  getPreset: (...args: unknown[]) => mockGetPreset(...args),
}));

vi.mock("@/lib/flamingo/executeFullReport", () => ({
  executeFullReport: (...args: unknown[]) => mockExecuteFullReport(...args),
}));

describe("processAnalyzeMusicRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("custom prompt", () => {
    it("returns success with model response for a custom prompt", async () => {
      mockCallFlamingoGenerate.mockResolvedValue({
        response: "This is jazz music",
        elapsed_seconds: 1.5,
      });

      const result = await processAnalyzeMusicRequest({
        prompt: "What genre is this?",
        audio_url: "https://example.com/song.mp3",
        max_new_tokens: 512,
        temperature: 1.0,
        top_p: 1.0,
        do_sample: false,
      });

      expect(result).toEqual({
        type: "success",
        response: "This is jazz music",
        elapsed_seconds: 1.5,
      });
      expect(mockCallFlamingoGenerate).toHaveBeenCalledWith({
        prompt: "What genre is this?",
        audio_url: "https://example.com/song.mp3",
        max_new_tokens: 512,
        temperature: 1.0,
        top_p: 1.0,
        do_sample: false,
      });
    });
  });

  describe("full_report preset", () => {
    it("returns success with report for full_report preset", async () => {
      mockExecuteFullReport.mockResolvedValue({
        report: { metadata: { title: "Song" } },
        elapsed_seconds: 30.5,
      });

      const result = await processAnalyzeMusicRequest({
        preset: "full_report",
        audio_url: "https://example.com/song.mp3",
        max_new_tokens: 512,
        temperature: 1.0,
        top_p: 1.0,
        do_sample: false,
      });

      expect(result).toEqual({
        type: "success",
        preset: "full_report",
        report: { metadata: { title: "Song" } },
        elapsed_seconds: 30.5,
      });
      expect(mockExecuteFullReport).toHaveBeenCalledWith("https://example.com/song.mp3");
    });

    it("returns error when full_report preset has no audio_url", async () => {
      const result = await processAnalyzeMusicRequest({
        preset: "full_report",
        max_new_tokens: 512,
        temperature: 1.0,
        top_p: 1.0,
        do_sample: false,
      });

      expect(result).toEqual({
        type: "error",
        error: "audio_url is required for the full_report preset",
      });
    });
  });

  describe("individual preset", () => {
    it("returns success with parsed response for a known preset", async () => {
      mockGetPreset.mockReturnValue({
        name: "mood_tags",
        prompt: "Describe the mood",
        requiresAudio: true,
        params: {
          max_new_tokens: 256,
          temperature: 0.7,
          do_sample: true,
        },
        parseResponse: (raw: string) => JSON.parse(raw),
      });
      mockCallFlamingoGenerate.mockResolvedValue({
        response: '{"mood":"happy"}',
        elapsed_seconds: 2.0,
      });

      const result = await processAnalyzeMusicRequest({
        preset: "mood_tags",
        audio_url: "https://example.com/song.mp3",
        max_new_tokens: 512,
        temperature: 1.0,
        top_p: 1.0,
        do_sample: false,
      });

      expect(result).toEqual({
        type: "success",
        preset: "mood_tags",
        response: { mood: "happy" },
        elapsed_seconds: 2.0,
      });
      expect(mockCallFlamingoGenerate).toHaveBeenCalledWith({
        prompt: "Describe the mood",
        audio_url: "https://example.com/song.mp3",
        max_new_tokens: 256,
        temperature: 0.7,
        top_p: undefined,
        do_sample: true,
      });
    });

    it("returns error for an unknown preset", async () => {
      mockGetPreset.mockReturnValue(undefined);

      const result = await processAnalyzeMusicRequest({
        preset: "nonexistent_preset",
        audio_url: "https://example.com/song.mp3",
        max_new_tokens: 512,
        temperature: 1.0,
        top_p: 1.0,
        do_sample: false,
      });

      expect(result).toEqual({
        type: "error",
        error: "Unknown preset: nonexistent_preset",
      });
    });

    it("returns error when preset requires audio but none provided", async () => {
      mockGetPreset.mockReturnValue({
        name: "mood_tags",
        prompt: "Describe the mood",
        requiresAudio: true,
        params: { max_new_tokens: 256, temperature: 0.7, do_sample: true },
      });

      const result = await processAnalyzeMusicRequest({
        preset: "mood_tags",
        max_new_tokens: 512,
        temperature: 1.0,
        top_p: 1.0,
        do_sample: false,
      });

      expect(result).toEqual({
        type: "error",
        error: 'The "mood_tags" preset requires an audio_url',
      });
    });

    it("falls back to raw response when parseResponse throws", async () => {
      mockGetPreset.mockReturnValue({
        name: "mood_tags",
        prompt: "Describe the mood",
        requiresAudio: false,
        params: { max_new_tokens: 256, temperature: 0.7, do_sample: true },
        parseResponse: () => {
          throw new Error("parse failed");
        },
      });
      mockCallFlamingoGenerate.mockResolvedValue({
        response: "raw text",
        elapsed_seconds: 1.0,
      });

      const result = await processAnalyzeMusicRequest({
        preset: "mood_tags",
        max_new_tokens: 512,
        temperature: 1.0,
        top_p: 1.0,
        do_sample: false,
      });

      expect(result).toEqual({
        type: "success",
        preset: "mood_tags",
        response: "raw text",
        elapsed_seconds: 1.0,
      });
    });
  });

  describe("inference failure", () => {
    it("throws when callFlamingoGenerate fails", async () => {
      mockCallFlamingoGenerate.mockRejectedValue(new Error("Modal returned 503"));

      await expect(
        processAnalyzeMusicRequest({
          prompt: "What genre?",
          audio_url: "https://example.com/song.mp3",
          max_new_tokens: 512,
          temperature: 1.0,
          top_p: 1.0,
          do_sample: false,
        }),
      ).rejects.toThrow("Modal returned 503");
    });
  });
});
