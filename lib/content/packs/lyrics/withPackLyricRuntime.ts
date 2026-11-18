import { createHash } from "node:crypto";
import {
  PACK_LYRIC_FONT_SHA256,
  type PackLyricMediaCapability,
  type PackLyricRuntime,
} from "./packLyricRenderTypes";
/** Never allocates the paid default runtime. The injected leaf owns bounded capture, cancellation and its directory. */
export async function withPackLyricRuntime<T>(
  capability: PackLyricMediaCapability | undefined,
  run: (runtime: PackLyricRuntime, ffmpeg: string, ffprobe: string) => Promise<T>,
): Promise<T> {
  if (!capability) throw new Error("lyric_renderer_unavailable");
  if (
    !Buffer.isBuffer(capability.fontBytes) ||
    createHash("sha256").update(capability.fontBytes).digest("hex") !== PACK_LYRIC_FONT_SHA256
  )
    throw new Error("Unqualified lyric font");
  const fontBytes = Buffer.from(capability.fontBytes);
  return capability.withRuntime(async (runtime, ffmpeg, ffprobe) => {
    let busy = false,
      expired = false;
    const bounded: PackLyricRuntime = {
      fileSize: runtime.fileSize.bind(runtime),
      removeFiles: runtime.removeFiles.bind(runtime),
      abort: runtime.abort.bind(runtime),
      cleanup: runtime.cleanup.bind(runtime),
      writeFiles: async files => {
        if (expired || files.some(f => f.content.length > 50 * 1024 * 1024))
          throw new Error("Lyric write/deadline bound exceeded");
        return runtime.writeFiles(files);
      },
      runCommand: async (command, args) => {
        if (command !== ffmpeg && command !== ffprobe) throw new Error("Unqualified lyric command");
        if (expired || busy) throw new Error("Lyric runtime deadline/concurrency bound");
        busy = true;
        try {
          const result = await runtime.runCommand(
            command,
            command === ffmpeg
              ? [
                  "-max_alloc",
                  "67108864",
                  "-threads",
                  "1",
                  "-filter_threads",
                  "1",
                  "-filter_complex_threads",
                  "1",
                  ...args,
                ]
              : ["-max_alloc", "67108864", ...args],
          );
          if (expired) throw new Error("Lyric runtime deadline exceeded");
          return {
            ...result,
            stdout: async () => {
              const text = await result.stdout();
              if (Buffer.byteLength(text) > 1024 * 1024)
                throw new Error("Lyric command capture bound exceeded");
              return text;
            },
          };
        } finally {
          busy = false;
        }
      },
      readFileToBuffer: async ({ path }) => {
        if (expired) throw new Error("Lyric runtime deadline exceeded");
        const size = await runtime.fileSize(path);
        if (!Number.isSafeInteger(size) || size < 0 || size > 50 * 1024 * 1024)
          throw new Error("Lyric file bound exceeded before read");
        const bytes = await runtime.readFileToBuffer({ path });
        if (!bytes || bytes.length !== size) throw new Error("Lyric file changed during read");
        return bytes;
      },
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        expired = true;
        reject(new Error("Lyric runtime deadline exceeded"));
        void runtime.abort().catch(() => {});
      }, 180000);
    });
    try {
      return await Promise.race([
        deadline,
        (async () => {
          const version = await bounded.runCommand(ffmpeg, ["-version"]);
          if (
            version.exitCode !== 0 ||
            createHash("sha256")
              .update(await version.stdout())
              .digest("hex") !== capability.rendererBuildSha256
          )
            throw new Error("Unqualified renderer build");
          await bounded.writeFiles([{ path: "lyric-font.ttf", content: fontBytes }]);
          // A missing font must fail: a successful render would reveal implicit Fontconfig fallback.
          const missing = await bounded.runCommand(ffmpeg, [
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=s=16x16",
            "-vf",
            "drawtext=fontfile=lyric-absent.ttf:text=check",
            "-frames:v",
            "1",
            "-f",
            "null",
            "-",
          ]);
          if (missing.exitCode === 0) throw new Error("Implicit font fallback is not qualified");
          return run(bounded, ffmpeg, ffprobe);
        })(),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
      try {
        await runtime.abort();
      } finally {
        await runtime.cleanup();
      }
    }
  });
}
