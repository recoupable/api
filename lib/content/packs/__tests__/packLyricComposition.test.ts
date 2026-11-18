import { it, expect, vi } from "vitest";
import { composePackMedia } from "../composePackMedia";
import { verifiedLyricAlignmentFixture } from "../lyrics/__tests__/fixtures/verifiedLyricAlignment";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm, stat, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { localLyricCapability } from "../lyrics/__tests__/fixtures/localLyricCapability";
const defaults = vi.hoisted(() => ({
  fetch: vi.fn(() => {
    throw new Error("Forbidden default fetch");
  }),
  runtime: vi.fn(() => {
    throw new Error("Forbidden paid runtime");
  }),
  store: vi.fn(() => {
    throw new Error("Forbidden default store");
  }),
}));
vi.mock("../fetchPackMedia", () => ({ fetchPackMedia: defaults.fetch }));
vi.mock("../withPackMediaRuntime", () => ({ withPackMediaRuntime: defaults.runtime }));
vi.mock("../storePackFile", () => ({ storePackFile: defaults.store }));
it("fails unavailable before default fetch/runtime/storage, including the image-only early branch", async () => {
  await expect(
    composePackMedia("fixture-owner", {
      images: ["fixture:image"],
      audioUrl: "fixture:song",
      start: 5,
      seconds: 3,
      visualizer: false,
      lyrics: verifiedLyricAlignmentFixture(),
    }),
  ).rejects.toThrow(/unavailable/);
  expect(defaults.fetch).not.toHaveBeenCalled();
  expect(defaults.runtime).not.toHaveBeenCalled();
  expect(defaults.store).not.toHaveBeenCalled();
});
const command = promisify(execFile);
const fontPath = process.env.PACK_LYRIC_TEST_FONT;
it.skipIf(!fontPath || process.platform !== "darwin")(
  "LOCAL QUALIFICATION: abort kills measured wrapper and FFmpeg child",
  async () => {
    vi.stubEnv("PACK_LYRIC_MEASURE_RSS", "1");
    const fixture = await localLyricCapability(fontPath!, Buffer.alloc(0), Buffer.alloc(0));
    try {
      await fixture.capability.withRuntime(async runtime => {
        const pending = runtime.runCommand("ffmpeg", [
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          "color=s=16x16",
          "-f",
          "null",
          "-",
        ]);
        let settled = false;
        void pending.then(() => {
          settled = true;
        });
        await new Promise(resolve => setTimeout(resolve, 300));
        expect(settled).toBe(false);
        const started = Date.now();
        await runtime.abort();
        expect((await pending).exitCode).not.toBe(0);
        expect(Date.now() - started).toBeLessThan(2000);
        const groups = (await command("ps", ["-axo", "pgid="])).stdout.split(/\s+/).map(Number);
        expect(fixture.trace[0].processGroup).toBeGreaterThan(0);
        expect(groups).not.toContain(fixture.trace[0].processGroup);
        await runtime.cleanup();
      });
      expect(fixture.isCleaned()).toBe(true);
      await expect(stat(fixture.root)).rejects.toThrow();
    } finally {
      await fixture.dispose();
      vi.unstubAllEnvs();
    }
  },
  5000,
);
it.skipIf(!fontPath)(
  "LOCAL QUALIFICATION: callback signal failure rejects and preserves uncertain ownership",
  async () => {
    const fixture = await localLyricCapability(fontPath!, Buffer.alloc(0), Buffer.alloc(0));
    const originalKill = process.kill.bind(process);
    const signal = vi.spyOn(process, "kill").mockImplementation((pid, kind) => {
      if (pid < 0 && kind === "SIGKILL")
        throw Object.assign(new Error("injected signal denial"), { code: "EPERM" });
      return originalKill(pid, kind);
    });
    try {
      await fixture.capability.withRuntime(async runtime => {
        await expect(runtime.runCommand("ffmpeg", ["-version"])).rejects.toThrow(
          /injected signal denial/,
        );
        await expect(runtime.abort()).rejects.toThrow(/unconfirmed/);
        await expect(runtime.cleanup()).rejects.toThrow(/preserve/);
        expect((await stat(fixture.root)).isDirectory()).toBe(true);
        expect(fixture.isCleaned()).toBe(false);
      });
    } finally {
      signal.mockRestore();
      // Finite version command only: independently verify group absence before test-owned cleanup.
      const groups = (await command("ps", ["-axo", "pgid="])).stdout.split(/\s+/).map(Number);
      expect(groups).not.toContain(fixture.trace[0].processGroup);
      await rm(fixture.root, { recursive: true, force: true });
    }
  },
  5000,
);
it.skipIf(!fontPath)(
  "LOCAL QUALIFICATION: owned paths and local protocols are enforced before I/O",
  async () => {
    const fixture = await localLyricCapability(fontPath!, Buffer.alloc(0), Buffer.alloc(0));
    try {
      await fixture.capability.withRuntime(async runtime => {
        for (const path of ["", ".", "..", "../outside", "/outside", "nested/file"]) {
          await expect(runtime.writeFiles([{ path, content: Buffer.alloc(0) }])).rejects.toThrow(
            /Unsafe/,
          );
          await expect(runtime.fileSize(path)).rejects.toThrow(/Unsafe/);
          await expect(runtime.readFileToBuffer({ path })).rejects.toThrow(/Unsafe/);
          await expect(runtime.removeFiles([path])).rejects.toThrow(/Unsafe/);
        }
        await expect(
          runtime.runCommand("ffmpeg", ["-protocol_whitelist", "http", "-version"]),
        ).rejects.toThrow(/protocol/);
        await expect(
          runtime.runCommand("ffmpeg", ["-i", "../outside", "output.mp4"]),
        ).rejects.toThrow(/Unsafe/);
        expect(fixture.trace).toHaveLength(0);
        await runtime.cleanup();
      });
    } finally {
      await fixture.dispose();
    }
  },
);
// Explicit qualification prerequisite: CI without the ignored local font does NOT qualify rendering.
it
  .skipIf(!fontPath)
  .each([24, 60, "vfr", "max", "short", "overflow", "wrong-hash", "bad-probe"] as const)(
  "LOCAL QUALIFICATION: exact audio and lyric frames on %s motion with nonzero PTS",
  async rate => {
    const directory = await mkdtemp(join(tmpdir(), "pack-lyric-source-"));
    let fixture: Awaited<ReturnType<typeof localLyricCapability>> | undefined;
    try {
      const sourceSeconds = rate === "max" ? 10 : 1.2;
      await command(
        "ffmpeg",
        [
          "-v",
          "error",
          "-y",
          "-f",
          "lavfi",
          "-i",
          `aevalsrc=sin(2*PI*if(lt(t\\,0.4)\\,440\\,if(lt(t\\,0.8)\\,880\\,1320))*t):s=8000:d=${sourceSeconds}`,
          "-c:a",
          "alac",
          "song.m4a",
        ],
        { cwd: directory },
      );
      await command(
        "ffmpeg",
        [
          "-v",
          "error",
          "-y",
          "-f",
          "lavfi",
          "-i",
          `color=c=blue:s=360x640:r=${rate === 24 || rate === "max" ? 24 : 60}:d=${rate === "short" ? 0.1 : sourceSeconds}`,
          "-f",
          "lavfi",
          "-i",
          `sine=frequency=220:duration=${sourceSeconds}`,
          "-c:a",
          "aac",
          "-vf",
          rate === "vfr"
            ? "select=not(mod(n\\,3))+not(mod(n\\,5)),setpts=PTS+2/TB"
            : "setpts=PTS+2/TB",
          "-fps_mode",
          "vfr",
          "-copyts",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "motion.mp4",
        ],
        { cwd: directory },
      );
      const originalProbe = JSON.parse(
        (
          await command("ffprobe", ["-v", "error", "-show_streams", "-of", "json", "motion.mp4"], {
            cwd: directory,
          })
        ).stdout,
      );
      expect(Number(originalProbe.streams[0].start_time)).toBeGreaterThan(0);
      const audio = await readFile(join(directory, "song.m4a"));
      const visual = await readFile(join(directory, "motion.mp4"));
      fixture = await localLyricCapability(fontPath!, audio, visual);
      const lyrics = verifiedLyricAlignmentFixture();
      lyrics.expected.recording = {
        storageKey: "fixture/song.m4a",
        sha256: createHash("sha256").update(audio).digest("hex"),
        durationMs: sourceSeconds * 1000,
      };
      lyrics.expected.excerpt = { startMs: 400, endMs: rate === "max" ? 8976 : 1000 };
      lyrics.alignment.target = structuredClone(lyrics.expected);
      lyrics.alignment.verifiedRange = { startMs: 0, endMs: sourceSeconds * 1000 };
      lyrics.alignment.words = [
        { text: "Soft", startMs: 350, endMs: 500 },
        { text: "50% <&>", startMs: 650, endMs: 800 },
      ];
      if (rate === "max")
        lyrics.alignment.words = Array.from({ length: 128 }, (_, n) => ({
          text: "A",
          startMs: 400 + n * 67,
          endMs: 434 + n * 67,
        }));
      if (rate === "overflow") lyrics.alignment.words[0].text = "W".repeat(128);
      if (rate === "wrong-hash") {
        lyrics.expected.recording.sha256 = "f".repeat(64);
        lyrics.alignment.target = structuredClone(lyrics.expected);
      }
      if (rate === "bad-probe") {
        const allocate = fixture.capability.withRuntime;
        fixture.capability.withRuntime = work =>
          allocate((runtime, ffmpeg, ffprobe) =>
            work(
              {
                ...runtime,
                runCommand: async (cmd, args) =>
                  cmd === ffprobe && args.includes("output.mp4")
                    ? {
                        exitCode: 0,
                        stdout: async () =>
                          JSON.stringify({ streams: [], format: { duration: "NaN" } }),
                      }
                    : runtime.runCommand(cmd, args),
              },
              ffmpeg,
              ffprobe,
            ),
          );
      }
      const seconds = (lyrics.expected.excerpt.endMs - 400) / 1000;
      const expectedFrames = Math.ceil(seconds * 30);
      const started = Date.now();
      const pending = composePackMedia(
        "fixture-owner",
        {
          images: [],
          motion: "fixture:motion",
          audioUrl: "fixture:song",
          start: 0.4,
          seconds,
          visualizer: false,
          lyrics,
        },
        fixture.capability,
      );
      if (["short", "overflow", "wrong-hash", "bad-probe"].includes(String(rate))) {
        await expect(pending).rejects.toThrow();
        expect(fixture.getOutput()).toHaveLength(0);
        if (rate === "wrong-hash") {
          expect(fixture.trace).toHaveLength(0);
          expect(fixture.isCleaned()).toBe(false); // fetch validation precedes allocation
        } else {
          expect(fixture.isCleaned()).toBe(true);
          await expect(stat(fixture.root)).rejects.toThrow();
        }
        return;
      }
      const result = await pending;
      expect(fixture.isCleaned()).toBe(true);
      expect(fixture.maxActive()).toBe(1);
      await expect(stat(fixture.root)).rejects.toThrow();
      expect(result.probe).toMatchObject({
        audio: true,
        width: 1080,
        height: 1920,
        audio_start_seconds: 0.4,
        lyric_scope: "local-injected-only",
      });
      await writeFile(join(directory, "output.mp4"), fixture.getOutput());
      const frames = await command(
        "ffmpeg",
        [
          "-v",
          "error",
          "-i",
          "output.mp4",
          "-vf",
          "crop=864:288:108:816,scale=216:72",
          "-pix_fmt",
          "gray",
          "-f",
          "rawvideo",
          "pipe:1",
        ],
        { cwd: directory, encoding: "buffer", maxBuffer: 8 * 1024 * 1024 },
      );
      const pixels = frames.stdout as Buffer,
        size = 216 * 72;
      expect(pixels.length / size).toBe(expectedFrames);
      for (let n = 0; n < expectedFrames; n++) {
        const white = pixels.subarray(n * size, (n + 1) * size).filter(v => v > 180).length;
        expect(white > 5, `frame ${n}`).toBe(
          lyrics.alignment.words.some(
            c => (c.startMs - 400) * 30 <= n * 1000 && n * 1000 < (c.endMs - 400) * 30,
          ),
        );
      }
      const decoded = await command(
        "ffmpeg",
        [
          "-v",
          "error",
          "-i",
          "output.mp4",
          "-vn",
          "-ac",
          "1",
          "-ar",
          "8000",
          "-f",
          "s16le",
          "pipe:1",
        ],
        { cwd: directory, encoding: "buffer", maxBuffer: 1024 * 1024 },
      );
      const pcm = decoded.stdout as Buffer;
      const reference = async (start: string) =>
        (
          await command(
            "ffmpeg",
            [
              "-v",
              "error",
              "-i",
              "song.m4a",
              "-ss",
              start,
              "-t",
              String(seconds),
              "-vn",
              "-ac",
              "1",
              "-ar",
              "8000",
              "-f",
              "s16le",
              "pipe:1",
            ],
            { cwd: directory, encoding: "buffer", maxBuffer: 1024 * 1024 },
          )
        ).stdout as Buffer;
      const exact = await reference("0.400");
      const shifted = await reference("0.413");
      const normalizedError = (referencePcm: Buffer) => {
        expect(pcm.length).toBeGreaterThanOrEqual(referencePcm.length);
        let error = 0,
          power = 0;
        for (let n = 0; n < referencePcm.length; n += 2) {
          const value = referencePcm.readInt16LE(n);
          error += (pcm.readInt16LE(n) - value) ** 2;
          power += value ** 2;
        }
        return Math.sqrt(error / power);
      };
      const pcmEvidence = {
        exactSamples: exact.length / 2,
        exactNormalizedRmse: normalizedError(exact),
        shifted13msNormalizedRmse: normalizedError(shifted),
      };
      // Lossy AAC tolerance: compare every decoded sample, including excerpt edges.
      // 20% normalized RMS permits codec error while the shifted negative control must fail.
      expect(pcmEvidence.exactSamples).toBe(Math.round(seconds * 8000));
      expect(pcmEvidence.exactNormalizedRmse).toBeLessThan(0.2);
      expect(pcmEvidence.shifted13msNormalizedRmse).toBeGreaterThan(0.2);
      const frequency = (start: number, end: number) => {
        let crossings = 0;
        for (let n = Math.floor(start * 8000) + 1; n < end * 8000; n++)
          if (pcm.readInt16LE((n - 1) * 2) < 0 && pcm.readInt16LE(n * 2) >= 0) crossings++;
        return crossings / (end - start);
      };
      if (process.env.PACK_LYRIC_OUTPUT_DIR) {
        const destination = process.env.PACK_LYRIC_OUTPUT_DIR;
        await mkdir(destination, { recursive: true });
        await writeFile(join(destination, `local-${rate}.mp4`), fixture.getOutput());
        await writeFile(
          join(destination, `local-${rate}.json`),
          JSON.stringify(
            {
              rate,
              originalProbe,
              pcmEvidence,
              result,
              trace: fixture.trace,
              maxConcurrent: fixture.maxActive(),
              cleanupConfirmed: fixture.isCleaned(),
              frequencies: [frequency(0.1, 0.3), frequency(0.45, 0.55)],
              elapsedMs: Date.now() - started,
              nodePeakRssBytes: process.resourceUsage().maxRSS * 1024,
            },
            null,
            2,
          ),
        );
      }
      expect(frequency(0.1, 0.3)).toBeGreaterThan(870);
      expect(frequency(0.1, 0.3)).toBeLessThan(890);
      expect(frequency(0.45, 0.55)).toBeGreaterThan(1300);
      expect(frequency(0.45, 0.55)).toBeLessThan(1340);
    } finally {
      await fixture?.dispose();
      await rm(directory, { recursive: true, force: true });
    }
  },
  180000,
);
