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
  const fontBytes = await readFile(fontPath);
  const rendererBuildSha256 = createHash("sha256")
    .update((await command("ffmpeg", ["-version"])).stdout)
    .digest("hex");
  const root = await mkdtemp(join(tmpdir(), "pack-lyric-local-"));
  try {
    await mkdir(join(root, "empty-fonts"));
    await writeFile(
      join(root, "fonts.conf"),
      `<?xml version="1.0"?><fontconfig><dir>${root}/empty-fonts</dir><cachedir>${root}/cache</cachedir></fontconfig>`,
    );
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
  const env = { ...process.env, FONTCONFIG_FILE: join(root, "fonts.conf"), FONTCONFIG_PATH: root };
  const children = new Set<ReturnType<typeof execFile>>();
  const uncertain = new Set<number>();
  const killed = new WeakSet<ReturnType<typeof execFile>>();
  const killGroup = (child: ReturnType<typeof execFile>) => {
    if (!child.pid || killed.has(child)) return;
    try {
      process.kill(-child.pid, "SIGKILL");
      killed.add(child);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
        uncertain.add(child.pid);
        throw error;
      }
    }
  };
  const trace: {
    command: string;
    args: string[];
    elapsedMs?: number;
    peakRssBytes?: number;
    processGroup?: number;
  }[] = [];
  let output: Buffer = Buffer.alloc(0);
  let cleaned = false,
    active = 0,
    maxActive = 0;
  const capability: PackLyricMediaCapability = {
    fontBytes,
    rendererBuildSha256,
    fetchMedia: async (url, { signal, maxBytes }) => {
      signal.throwIfAborted();
      const bytes = url === "fixture:song" ? audio : visual;
      if (bytes.length > maxBytes) throw new Error("Source byte bound");
      return { bytes, contentType: url === "fixture:song" ? "Audio/MP4" : "Video/MP4" };
    },
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
              processGroup?: number;
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
                  entry.processGroup = child.pid;
                  let stdout = Buffer.alloc(0),
                    stderr = Buffer.alloc(0);
                  let failure: Error | undefined;
                  const terminate = () => {
                    try {
                      killGroup(child);
                    } catch (error) {
                      failure = error as Error;
                      reject(error);
                    }
                  };
                  const capture = (which: "stdout" | "stderr", chunk: Buffer) => {
                    const current = which === "stdout" ? stdout : stderr;
                    if (current.length + chunk.length > 1024 * 1024) {
                      failure = new Error("Child output exceeds capture bound");
                      terminate();
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
                  const deadline = setTimeout(terminate, 180000);
                  child.on("exit", terminate);
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
                  new Promise<void>((resolve, reject) => {
                    let grace: ReturnType<typeof setTimeout>;
                    const closed = () => {
                      clearTimeout(grace);
                      clearTimeout(limit);
                      resolve();
                    };
                    const fail = (error: unknown) => {
                      clearTimeout(grace);
                      clearTimeout(limit);
                      child.removeListener("close", closed);
                      if (child.pid) uncertain.add(child.pid);
                      reject(
                        new Error(
                          `Owned termination unconfirmed: directory=${root}, processGroup=${child.pid}; preserve files`,
                          { cause: error },
                        ),
                      );
                    };
                    const limit = setTimeout(
                      () => fail(new Error("closure deadline exceeded")),
                      2000,
                    );
                    grace = setTimeout(() => {
                      try {
                        killGroup(child);
                      } catch (error) {
                        fail(error);
                      }
                    }, 250);
                    child.once("close", closed);
                    try {
                      if (child.pid && !killed.has(child)) process.kill(-child.pid, "SIGTERM");
                    } catch (error) {
                      if ((error as NodeJS.ErrnoException).code !== "ESRCH") fail(error);
                    }
                  }),
              ),
            );
            if (uncertain.size)
              throw new Error(
                `Termination unconfirmed; preserve directory=${root}, processGroups=${[...uncertain]}`,
              );
          },
          cleanup: async () => {
            if (children.size || uncertain.size)
              throw new Error(`Owned processes remain; preserve ${root}`);
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
    dispose: async () => {
      if (children.size || uncertain.size)
        throw new Error(`Owned processes remain; preserve ${root}`);
      await rm(root, { recursive: true, force: true });
    },
  };
}
