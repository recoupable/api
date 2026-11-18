import { it, expect, vi } from "vitest";
import { withPackLyricRuntime } from "../withPackLyricRuntime";

import { createHash } from "node:crypto";
import type { PackLyricMediaCapability, PackLyricRuntime } from "../packLyricRenderTypes";
it("refuses absent capability before runtime allocation", async () => {
  const work = vi.fn();
  await expect(withPackLyricRuntime(undefined, work)).rejects.toThrow(/unavailable/);
  expect(work).not.toHaveBeenCalled();
});
it("refuses unqualified font before runtime allocation", async () => {
  const allocate = vi.fn();
  await expect(
    withPackLyricRuntime(
      {
        fontBytes: Buffer.from("wrong"),
        rendererBuildSha256: "a".repeat(64),
        withRuntime: allocate,
      } as never,
      vi.fn(),
    ),
  ).rejects.toThrow(/font/);
  expect(allocate).not.toHaveBeenCalled();
});
vi.mock("../packLyricRenderTypes", async () => ({
  PACK_LYRIC_FONT_SHA256: (await import("node:crypto"))
    .createHash("sha256")
    .update("synthetic-font")
    .digest("hex"),
}));
function controlled() {
  const runtime: PackLyricRuntime = {
    writeFiles: vi.fn(),
    runCommand: vi.fn(async (_cmd, args) => ({
      exitCode: args.includes("-version") ? 0 : 1,
      stdout: async () => "synthetic-build",
    })),
    fileSize: vi.fn(async () => 1),
    readFileToBuffer: vi.fn(async () => Buffer.from("x")),
    removeFiles: vi.fn(),
    abort: vi.fn(async () => {}),
    cleanup: vi.fn(async () => {}),
  };
  const cap = {
    fontBytes: Buffer.from("synthetic-font"),
    rendererBuildSha256: createHash("sha256").update("synthetic-build").digest("hex"),
    withRuntime: async <T>(run: (r: PackLyricRuntime, f: string, p: string) => Promise<T>) =>
      run(runtime, "ffmpeg", "ffprobe"),
  } as PackLyricMediaCapability;
  return { runtime, cap };
}
it("cleans an owned runtime on callback failure", async () => {
  const { runtime, cap } = controlled();
  await expect(
    withPackLyricRuntime(cap, async () => {
      throw new Error("render failed");
    }),
  ).rejects.toThrow("render failed");
  expect(runtime.abort).toHaveBeenCalled();
  expect(runtime.cleanup).toHaveBeenCalled();
});
it("does not read an oversized file into memory", async () => {
  const { runtime, cap } = controlled();
  vi.mocked(runtime.fileSize).mockResolvedValue(50 * 1024 * 1024 + 1);
  await expect(
    withPackLyricRuntime(cap, r => r.readFileToBuffer({ path: "output.mp4" })),
  ).rejects.toThrow(/before read/);
  expect(runtime.readFileToBuffer).not.toHaveBeenCalled();
});
it("refuses hidden implicit font fallback", async () => {
  const { runtime, cap } = controlled();
  vi.mocked(runtime.runCommand).mockResolvedValue({
    exitCode: 0,
    stdout: async () => "synthetic-build",
  });
  const work = vi.fn();
  await expect(withPackLyricRuntime(cap, work)).rejects.toThrow(/fallback/);
  expect(work).not.toHaveBeenCalled();
  expect(runtime.cleanup).toHaveBeenCalled();
});
it("preserves owned files when abort fails", async () => {
  const { runtime, cap } = controlled();
  vi.mocked(runtime.abort).mockRejectedValue(new Error("abort failed"));
  await expect(withPackLyricRuntime(cap, async () => "done")).rejects.toThrow("abort failed");
  expect(runtime.cleanup).not.toHaveBeenCalled();
});
it("rejects command concurrency", async () => {
  const { cap } = controlled();
  await expect(
    withPackLyricRuntime(cap, async r =>
      Promise.all([r.runCommand("ffmpeg", []), r.runCommand("ffmpeg", [])]),
    ),
  ).rejects.toThrow(/concurrency/);
});
it("aborts and cleans at the 180-second deadline", async () => {
  vi.useFakeTimers();
  try {
    const { runtime, cap } = controlled();
    const work = vi.fn(() => new Promise<never>(() => {}));
    const result = withPackLyricRuntime(cap, work);
    const rejected = expect(result).rejects.toThrow(/deadline/);
    await vi.advanceTimersByTimeAsync(180000);
    await rejected;
    expect(work).toHaveBeenCalled();
    expect(runtime.abort).toHaveBeenCalled();
    expect(runtime.cleanup).toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

it.each(["abort", "cleanup"] as const)(
  "bounds nonsettling %s and reports unconfirmed cleanup",
  async phase => {
    vi.useFakeTimers();
    try {
      const { runtime, cap } = controlled();
      vi.mocked(runtime[phase]).mockImplementation(() => new Promise<never>(() => {}));
      let failure: unknown;
      const result = withPackLyricRuntime(cap, async () => "done").catch(error => {
        failure = error;
      });
      await vi.advanceTimersByTimeAsync(5001);
      expect(failure).toBeInstanceOf(Error);
      expect(String(failure)).toMatch(/unconfirmed/);
      if (phase === "abort") expect(runtime.cleanup).not.toHaveBeenCalled();
      await result;
    } finally {
      vi.useRealTimers();
    }
  },
);
