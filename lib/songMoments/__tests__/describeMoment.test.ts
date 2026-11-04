import { describe, it, expect, vi, beforeEach } from "vitest";
import { describeMoment } from "../describeMoment";
import { callFlamingoGenerate } from "@/lib/flamingo/callFlamingoGenerate";

vi.mock("@/lib/flamingo/callFlamingoGenerate", () => ({ callFlamingoGenerate: vi.fn() }));

describe("describeMoment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has the model hear only the moment's clip and parses its words", async () => {
    vi.mocked(callFlamingoGenerate).mockResolvedValue({
      response:
        '{"description": "The chorus lands.", "emotion": ["euphoric"], "vocals": true, "best_for": ["ad"]}',
      elapsed_seconds: 2.5,
    });

    const result = await describeMoment({
      audioUrl: "https://example.com/song.mp3",
      start: 36.15,
      end: 50.9,
    });

    expect(callFlamingoGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ audio_url: "https://example.com/song.mp3", do_sample: false }),
      { clip: { start: 36.15, end: 50.9 } },
    );
    expect(result).toEqual({
      description: {
        description: "The chorus lands.",
        emotion: ["euphoric"],
        best_for: ["ad"],
        vocals: true,
      },
      elapsed_seconds: 2.5,
    });
  });
});
