import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, stat, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PackLyricMediaCapability } from "../../packLyricRenderTypes";
const command = promisify(execFile);
/** Explicit local test leaf. No network, sandbox, provider or remote storage implementation. */
export async function localLyricCapability(fontPath: string, audio: Buffer, visual: Buffer) {
  const root = await mkdtemp(join(tmpdir(), "pack-lyric-local-"));
  await mkdir(join(root, "empty-fonts"));
  await writeFile(
    join(root, "fonts.conf"),
    `<?xml version="1.0"?><fontconfig><dir>${root}/empty-fonts</dir><cachedir>${root}/cache</cachedir></fontconfig>`,
  );
  const env = { ...process.env, FONTCONFIG_FILE: join(root, "fonts.conf"), FONTCONFIG_PATH: root };
  const children = new Set<ReturnType<typeof execFile>>();
  const killed = new WeakSet<ReturnType<typeof execFile>>();
  const killGroup = (child: ReturnType<typeof execFile>) => {
    if (!child.pid || killed.has(child)) return;
    try {
      process.kill(-child.pid, "SIGKILL");
      killed.add(child);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  };
  const trace: { command: string; args: string[]; elapsedMs?: number; peakRssBytes?: number }[] =
    [];
  let output: Buffer = Buffer.alloc(0);
  let cleaned = false,
    active = 0,
    maxActive = 0;
  const capability: PackLyricMediaCapability = {
    fontBytes: await readFile(fontPath),
    rendererBuildSha256: createHash("sha256")
      .update((await command("ffmpeg", ["-version"])).stdout)
      .digest("hex"),
    fetchMedia: async url =>
      url === "fixture:song"
        ? { bytes: audio, contentType: "audio/mp4" }
        : { bytes: visual, contentType: "video/mp4" },
    storeFile: async (_owner, bytes, contentType) => {
      if (!cleaned) throw new Error("Store before cleanup");
      output = bytes;
      return { storage_key: "fixture/output.mp4", bytes: bytes.length, content_type: contentType };
    },
    withRuntime: async run =>
      run(
        {
          writeFiles: async files => {
            for (const f of files) {
              if (!/^[a-zA-Z0-9.-]+$/.test(f.path)) throw new Error("Unsafe fixture path");
              await writeFile(join(root, f.path), f.content);
            }
          },
          runCommand: async (cmd, args) => {
            if (!["ffmpeg", "ffprobe"].includes(cmd)) throw new Error("Forbidden fixture command");
            const entry: {
              command: string;
              args: string[];
              elapsedMs?: number;
              peakRssBytes?: number;
            } = { command: cmd, args };
            trace.push(entry);
            const started = Date.now();
            active++;
            maxActive = Math.max(maxActive, active);
            try {
              return await new Promise<{ exitCode: number; stdout: () => Promise<string> }>(
                (resolve, reject) => {
                  const measure =
                    process.env.PACK_LYRIC_MEASURE_RSS === "1" && process.platform === "darwin";
                  const child = spawn(
                    measure ? "/usr/bin/time" : cmd,
                    measure ? ["-l", cmd, ...args] : args,
                    { cwd: root, env, detached: true, stdio: ["ignore", "pipe", "pipe"] },
                  );
                  let stdout = Buffer.alloc(0),
                    stderr = Buffer.alloc(0);
                  let failure: Error | undefined;
                  const capture = (which: "stdout" | "stderr", chunk: Buffer) => {
                    const current = which === "stdout" ? stdout : stderr;
                    if (current.length + chunk.length > 1024 * 1024) {
                      failure = new Error("Child output exceeds capture bound");
                      killGroup(child);
                      return;
                    }
                    if (which === "stdout") stdout = Buffer.concat([current, chunk]);
                    else stderr = Buffer.concat([current, chunk]);
                  };
                  child.stdout.on("data", chunk => capture("stdout", chunk));
                  child.stderr.on("data", chunk => capture("stderr", chunk));
                  child.on("error", error => {
                    failure = error;
                  });
                  const deadline = setTimeout(() => killGroup(child), 180000);
                  child.on("exit", () => killGroup(child));
                  child.on("close", code => {
                    clearTimeout(deadline);
                    children.delete(child);
                    entry.elapsedMs = Date.now() - started;
                    const memory = /([0-9]+)\s+maximum resident set size/.exec(String(stderr));
                    if (memory) entry.peakRssBytes = Number(memory[1]);
                    if (failure) reject(failure);
                    else
                      resolve({
                        exitCode: code ?? 1,
                        stdout: async () => String(stdout.length ? stdout : stderr),
                      });
                  });
                  children.add(child);
                },
              );
            } finally {
              active--;
            }
          },
          fileSize: async path => (await stat(join(root, path))).size,
          readFileToBuffer: async ({ path }) => {
            if ((await stat(join(root, path))).size > 50 * 1024 * 1024)
              throw new Error("Read bound");
            return readFile(join(root, path));
          },
          removeFiles: async paths => {
            for (const path of paths) await rm(join(root, path), { force: true });
          },
          abort: async () => {
            await Promise.all(
              [...children].map(
                child =>
                  new Promise<void>(resolve => {
                    child.once("close", () => resolve());
                    killGroup(child);
                  }),
              ),
            );
          },
          cleanup: async () => {
            await rm(root, { recursive: true, force: true });
            cleaned = true;
          },
        },
        "ffmpeg",
        "ffprobe",
      ),
  };
  return {
    capability,
    root,
    trace,
    getOutput: () => output,
    isCleaned: () => cleaned,
    maxActive: () => maxActive,
    dispose: () => rm(root, { recursive: true, force: true }),
  };
}
