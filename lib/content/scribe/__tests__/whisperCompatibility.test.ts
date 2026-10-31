import { beforeEach, expect, it, vi } from "vitest";
import { transcribeAudio } from "../../transcribe/transcribeAudio";
const subscribe = vi.hoisted(() => vi.fn());
vi.mock("@/lib/fal/server", () => ({ default: { subscribe } }));
beforeEach(() => {
  vi.resetAllMocks();
  subscribe.mockResolvedValue({
    data: { text: "Hello", chunks: [{ timestamp: [0, 1], text: " Hello " }] },
  });
});
it("preserves the existing Whisper default and mapped response", async () => {
  const result = await transcribeAudio({
    audio_urls: ["https://example.invalid/song.wav"],
    language: "en",
    chunk_level: "word",
    diarize: false,
  });
  expect(subscribe).toHaveBeenCalledExactlyOnceWith("fal-ai/whisper", {
    input: {
      audio_url: "https://example.invalid/song.wav",
      task: "transcribe",
      language: "en",
      chunk_level: "word",
      diarize: false,
    },
  });
  expect(result).toEqual({
    audioUrl: "https://example.invalid/song.wav",
    fullLyrics: "Hello",
    segments: [{ start: 0, end: 1, text: "Hello" }],
    segmentCount: 1,
  });
});
