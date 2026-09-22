import { mkdtemp, writeFile, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { runAudioCommand } from "./runAudioCommand";
import type { AudioCommand } from "./types";
/** Produce a portable analysis copy; original recording bytes remain unchanged. */
export async function normalizeContextAudio(
  bytes: Buffer,
  expectedDuration: number,
  run: AudioCommand = runAudioCommand,
) {
  z.number().positive().max(7200).parse(expectedDuration);
  if (!bytes.length || bytes.length > 100 * 1024 * 1024)
    throw new Error("Source audio size outside limits");
  const directory = await mkdtemp(join(tmpdir(), "context-wav-"));
  const input = join(directory, "source.audio"),
    output = join(directory, "analysis.wav");
  const startedAt = new Date().toISOString(),
    start = Date.now();
  try {
    await writeFile(input, bytes);
    await run("ffmpeg", [
      "-nostdin",
      "-v",
      "error",
      "-xerror",
      "-i",
      input,
      "-map",
      "0:a:0",
      "-vn",
      "-ac",
      "1",
      "-ar",
      "24000",
      "-c:a",
      "pcm_s16le",
      "-fs",
      "350000000",
      output,
    ]);
    const size = (await stat(output)).size;
    if (!size || size > 350000000) throw new Error("Normalized audio size outside limits");
    const probe = JSON.parse(
      await run("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=codec_type,codec_name,sample_rate,channels",
        "-of",
        "json",
        output,
      ]),
    );
    const durationSeconds = Number(probe.format?.duration),
      stream = probe.streams?.[0];
    if (!Number.isFinite(durationSeconds) || Math.abs(durationSeconds - expectedDuration) > 0.25)
      throw new Error("Normalized audio duration changed");
    if (
      stream?.codec_type !== "audio" ||
      stream.codec_name !== "pcm_s16le" ||
      Number(stream.sample_rate) !== 24000 ||
      stream.channels !== 1
    )
      throw new Error("Normalized audio format does not match");
    await run("ffmpeg", [
      "-nostdin",
      "-v",
      "error",
      "-xerror",
      "-i",
      output,
      "-map",
      "0:a:0",
      "-f",
      "null",
      "-",
    ]);
    const normalized = await readFile(output);
    return {
      bytes: normalized,
      contentType: "audio/wav",
      trace: {
        startedAt,
        elapsedMs: Date.now() - start,
        durationSeconds,
        sizeBytes: size,
        codec: "pcm_s16le",
        sampleRate: 24000,
        channels: 1,
        sourceSha256: createHash("sha256").update(bytes).digest("hex"),
        sha256: createHash("sha256").update(normalized).digest("hex"),
      },
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
