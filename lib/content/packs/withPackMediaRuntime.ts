import { Sandbox } from "@vercel/sandbox";
/** A bounded isolated media runtime; provider files enter as bytes, never shell commands or URLs. */
export async function withPackMediaRuntime<T>(
  run: (sandbox: Sandbox, ffmpeg: string, ffprobe: string) => Promise<T>,
): Promise<T> {
  const sandbox = await Sandbox.create({
    runtime: "node22",
    timeout: 180_000,
    resources: { vcpus: 2 },
  });
  try {
    const install = await sandbox.runCommand("npm", [
      "install",
      "--no-audit",
      "--no-fund",
      "ffmpeg-static@5.2.0",
      "ffprobe-static@3.1.0",
    ]);
    if (install.exitCode !== 0) throw new Error("Media composition runtime unavailable");
    return await run(
      sandbox,
      "/vercel/sandbox/node_modules/ffmpeg-static/ffmpeg",
      "/vercel/sandbox/node_modules/ffprobe-static/bin/linux/x64/ffprobe",
    );
  } finally {
    await sandbox.stop().catch(() => {});
  }
}
