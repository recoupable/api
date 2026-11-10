import { describe, it, expect, vi, beforeEach } from "vitest";
import { describeMoments } from "../describeMoments";
import { callFlamingoGenerateBatch } from "@/lib/flamingo/callFlamingoGenerateBatch";

vi.mock("@/lib/flamingo/callFlamingoGenerateBatch", () => ({
  callFlamingoGenerateBatch: vi.fn(),
}));

const audioUrl = "https://example.com/song.mp3";
const hook = { type: "vocal_hook" as const, start: 36.15, end: 50.9 };
const climax = { type: "climax" as const, start: 143.36, end: 158.1 };
const reply =
  '{"description": "The chorus lands.", "emotion": ["euphoric"], "vocals": true, "best_for": ["ad"]}';
const words = {
  description: "The chorus lands.",
  emotion: ["euphoric"],
  best_for: ["ad"],
  vocals: true,
};

describe("describeMoments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks about every moment in one batch, each prompt hearing only its own clip", async () => {
    vi.mocked(callFlamingoGenerateBatch).mockResolvedValue({
      answers: [
        {
          id: "vocal_hook",
          response: reply,
          elapsed_seconds: 2.5,
          clip_start: 36.15,
          clip_end: 50.9,
        },
        { id: "climax", response: reply, elapsed_seconds: 3, clip_start: 143.36, clip_end: 158.1 },
      ],
      elapsed_seconds: 7,
    });

    const described = await describeMoments({ audioUrl, moments: [hook, climax] });

    expect(callFlamingoGenerateBatch).toHaveBeenCalledTimes(1);
    const [batch] = vi.mocked(callFlamingoGenerateBatch).mock.calls[0];
    expect(batch).toMatchObject({ audio_url: audioUrl, do_sample: false });
    expect(batch.prompts).toEqual([
      expect.objectContaining({ id: "vocal_hook", clip: { start: 36.15, end: 50.9 } }),
      expect.objectContaining({ id: "climax", clip: { start: 143.36, end: 158.1 } }),
    ]);
    expect(described.get("vocal_hook")).toEqual({ description: words, elapsed_seconds: 2.5 });
    expect(described.get("climax")).toEqual({ description: words, elapsed_seconds: 3 });
  });

  it("drops an answer that does not echo its clip, so words never come from the whole song", async () => {
    vi.mocked(callFlamingoGenerateBatch).mockResolvedValue({
      answers: [
        { id: "vocal_hook", response: reply, elapsed_seconds: 9 },
        { id: "climax", response: reply, elapsed_seconds: 3, clip_start: 143.36, clip_end: 158.1 },
      ],
      elapsed_seconds: 13,
    });

    const described = await describeMoments({ audioUrl, moments: [hook, climax] });

    expect(described.has("vocal_hook")).toBe(false);
    expect(described.has("climax")).toBe(true);
  });

  it("drops an answer whose reply holds nothing usable, so it is neither merged nor billed", async () => {
    vi.mocked(callFlamingoGenerateBatch).mockResolvedValue({
      answers: [
        {
          id: "vocal_hook",
          response: "I cannot describe this clip.",
          elapsed_seconds: 2,
          clip_start: 36.15,
          clip_end: 50.9,
        },
        { id: "climax", response: reply, elapsed_seconds: 3, clip_start: 143.36, clip_end: 158.1 },
      ],
      elapsed_seconds: 6,
    });

    const described = await describeMoments({ audioUrl, moments: [hook, climax] });

    expect([...described.keys()]).toEqual(["climax"]);
  });

  it("lets the batch's failure through for the caller to handle", async () => {
    vi.mocked(callFlamingoGenerateBatch).mockRejectedValue(
      new Error("Music analysis failed (status 503)"),
    );

    await expect(describeMoments({ audioUrl, moments: [hook] })).rejects.toThrow("status 503");
  });
});
