import { acquireContextYoutubeAudio } from "../acquireContextYoutubeAudio";
import { it, expect, vi } from "vitest";
import { writeFile, stat } from "node:fs/promises";
import { normalizeContextAudio } from "../normalizeContextAudio";
it("converts to PCM WAV and checks codec, duration, and cleanup", async () => {
  let output = "";
  const result = await normalizeContextAudio(Buffer.from("source"), 152, async (command, args) => {
    if (command === "ffmpeg" && args.includes("pcm_s16le")) {
      output = args.at(-1)!;
      await writeFile(output, Buffer.from("wav"));
      return "";
    }
    if (command === "ffprobe")
      return JSON.stringify({
        format: { duration: "152" },
        streams: [
          { codec_type: "audio", codec_name: "pcm_s16le", sample_rate: "24000", channels: 1 },
        ],
      });
    return "";
  });
  expect(result.contentType).toBe("audio/wav");
  expect(result.trace.sourceSha256).not.toBe(result.trace.sha256);
  await expect(stat(output)).rejects.toThrow();
});
it("rejects changed duration", async () => {
  await expect(
    normalizeContextAudio(Buffer.from("source"), 152, async (command, args) => {
      if (command === "ffmpeg") {
        await writeFile(args.at(-1)!, Buffer.from("wav"));
        return "";
      }
      return JSON.stringify({
        format: { duration: "30" },
        streams: [
          { codec_type: "audio", codec_name: "pcm_s16le", sample_rate: "24000", channels: 1 },
        ],
      });
    }),
  ).rejects.toThrow("duration");
});

it("stops before saving when normalization fails", async () => {
  const save = vi.fn();
  const result = await acquireContextYoutubeAudio(
    { title: "Song", artists: ["Artist"], durationSeconds: 152 },
    {
      search: vi.fn().mockResolvedValue({
        candidates: [{ id: "abcdefghijk", title: "Artist Song", duration: 152 }],
      }),
      download: vi
        .fn()
        .mockResolvedValue({ bytes: Buffer.from("source"), trace: { durationSeconds: 152 } }),
      normalize: vi.fn().mockRejectedValue(new Error("decode failed")),
      save,
    },
  );
  expect(result.status).toBe("failed");
  expect(result.steps.at(-1)?.name).toBe("Normalize audio to WAV");
  expect(save).not.toHaveBeenCalled();
});
