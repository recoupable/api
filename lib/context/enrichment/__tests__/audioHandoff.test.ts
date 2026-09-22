import { it, expect, vi } from "vitest";
import { analyzeContextAudio } from "../analyzeContextAudio";
it("runs presets independently and preserves one failure", async () => {
  const call = vi.fn().mockImplementation(async (_url, preset) => {
    if (preset === "lyric_transcription") throw Error("failed");
    return { content: "metadata" };
  });
  const results = await analyzeContextAudio("https://example.com/song.m4a", "secret", 152.23, call);
  expect(call).toHaveBeenCalledTimes(2);
  expect(results[0].status).toBe("fulfilled");
  expect(results[1].status).toBe("rejected");
});
