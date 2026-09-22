import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { runAudioCommand } from "./runAudioCommand";
import type { AudioCommand } from "./types";
/** Runs in a worker with yt-dlp/ffmpeg. Returns bytes for caller-owned storage; cleans temporary files. */
export async function downloadYoutubeAudio(
  videoId: string,
  expectedDuration: number,
  run: AudioCommand = runAudioCommand,
) {
  z.string()
    .regex(/^[\w-]{11}$/)
    .parse(videoId);
  z.number().positive().max(7200).parse(expectedDuration);
  const directory = await mkdtemp(join(tmpdir(), "context-audio-"));
  const path = join(directory, "audio.m4a");
  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const startedAt = new Date().toISOString();
  const start = Date.now();
  try {
    await run("yt-dlp", [
      "--ignore-config",
      "--js-runtimes",
      "node",
      "--no-playlist",
      "--no-progress",
      "--socket-timeout",
      "20",
      "--extractor-retries",
      "0",
      "--retries",
      "0",
      "--fragment-retries",
      "0",
      "--max-filesize",
      "100M",
      "--match-filter",
      "duration <= 7200",
      "-f",
      "bestaudio[ext=m4a]",
      "-o",
      path,
      "--",
      sourceUrl,
    ]);
    const size = (await stat(path)).size;
    if (!size || size > 100 * 1024 * 1024) throw new Error("Audio size outside limits");
    const probe = JSON.parse(
      await run("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=codec_type",
        "-of",
        "json",
        path,
      ]),
    );
    const durationSeconds = Number(probe.format?.duration);
    if (
      !probe.streams?.some((stream: { codec_type: string }) => stream.codec_type === "audio") ||
      !Number.isFinite(durationSeconds) ||
      Math.abs(durationSeconds - expectedDuration) > 3
    )
      throw new Error("Downloaded audio duration or stream does not match");
    await run("ffmpeg", ["-v", "error", "-xerror", "-i", path, "-map", "0:a:0", "-f", "null", "-"]);
    const bytes = await readFile(path);
    return {
      bytes,
      contentType: "audio/mp4",
      trace: {
        sourceUrl,
        videoId,
        startedAt,
        elapsedMs: Date.now() - start,
        durationSeconds,
        sizeBytes: size,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        coverage: "full_duration_candidate",
        verification: "metadata_and_decode_only",
      },
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
