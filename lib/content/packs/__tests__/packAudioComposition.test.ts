import { execFile, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { composePackMedia } from "../composePackMedia";
const command = promisify(execFile);
const fixture = vi.hoisted(() => ({
  directory: "",
  audio: Buffer.alloc(0),
  motion: Buffer.alloc(0),
  output: Buffer.alloc(0),
}));
vi.mock("../fetchPackMedia", () => ({
  fetchPackMedia: async (url: string) =>
    url.includes("song")
      ? { bytes: fixture.audio, contentType: "audio/wav" }
      : { bytes: fixture.motion, contentType: "video/mp4" },
}));
vi.mock("../storePackFile", () => ({
  storePackFile: async (_owner: string, bytes: Buffer, contentType: string) => {
    fixture.output = bytes;
    return {
      storage_key: "owner/release-packs/output.mp4",
      bytes: bytes.length,
      content_type: contentType,
    };
  },
}));
vi.mock("../withPackMediaRuntime", () => ({
  withPackMediaRuntime: async (run: any) =>
    run(
      {
        writeFiles: async (files: { path: string; content: Buffer }[]) => {
          for (const f of files) await writeFile(join(fixture.directory, f.path), f.content);
        },
        runCommand: async (cmd: string, args: string[]) => {
          try {
            const result = await command(cmd, args, {
              cwd: fixture.directory,
              maxBuffer: 5 * 1024 * 1024,
            });
            return { exitCode: 0, stdout: async () => String(result.stdout) };
          } catch (error) {
            return { exitCode: 1, stdout: async () => String(error) };
          }
        },
        readFileToBuffer: async ({ path }: { path: string }) =>
          readFile(join(fixture.directory, path)),
      },
      "ffmpeg",
      "ffprobe",
    ),
}));
it.skipIf(spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0)(
  "muxes the supplied song rather than the generated video's soundtrack and probes real output",
  async () => {
    fixture.directory = await mkdtemp(join(tmpdir(), "recoup-pack-audio-"));
    try {
      await command(
        "ffmpeg",
        ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=8", "song.wav"],
        { cwd: fixture.directory },
      );
      await command(
        "ffmpeg",
        [
          "-y",
          "-f",
          "lavfi",
          "-i",
          "color=c=navy:s=360x640:r=30",
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=880:duration=5",
          "-t",
          "5",
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-c:a",
          "aac",
          "motion.mp4",
        ],
        { cwd: fixture.directory },
      );
      fixture.audio = await readFile(join(fixture.directory, "song.wav"));
      fixture.motion = await readFile(join(fixture.directory, "motion.mp4"));
      const result = await composePackMedia("owner", {
        images: [],
        motion: "https://provider.example/motion.mp4",
        audioUrl: "https://owned.example/song.wav",
        start: 1,
        seconds: 5,
        visualizer: false,
      });
      expect(result.probe).toMatchObject({
        audio: true,
        width: 1080,
        height: 1920,
        audio_start_seconds: 1,
      });
      expect(result.probe.duration).toBeCloseTo(5, 1);
      await writeFile(join(fixture.directory, "checked.mp4"), fixture.output);
      const decoded = await command(
        "ffmpeg",
        [
          "-v",
          "error",
          "-i",
          "checked.mp4",
          "-vn",
          "-ac",
          "1",
          "-ar",
          "8000",
          "-f",
          "s16le",
          "pipe:1",
        ],
        { cwd: fixture.directory, encoding: "buffer", maxBuffer: 1024 * 1024 },
      );
      const pcm = decoded.stdout as Buffer;
      let crossings = 0;
      for (let index = 2; index < pcm.length; index += 2)
        if (pcm.readInt16LE(index - 2) < 0 && pcm.readInt16LE(index) >= 0) crossings++;
      const frequency = crossings / (pcm.length / 2 / 8000);
      expect(frequency).toBeGreaterThan(435);
      expect(frequency).toBeLessThan(445);
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  },
  30000,
);
