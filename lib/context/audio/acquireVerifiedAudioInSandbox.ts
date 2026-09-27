import { Sandbox } from "@vercel/sandbox";
import { z } from "zod";
import { verifiedAudioWorker } from "./verifiedAudioWorker";
const inputSchema = z.object({
  title: z.string().min(1).max(300),
  artists: z.array(z.string().min(1).max(200)).min(1).max(20),
  durationSeconds: z.number().positive().max(1200),
  previewUrl: z.string().url(),
});
/** Bounded hosted acquisition and waveform verification. No application secrets enter the worker. */
export async function acquireVerifiedAudioInSandbox(input: z.input<typeof inputSchema>) {
  const data = inputSchema.parse(input);
  const preview = new URL(data.previewUrl);
  if (
    preview.protocol !== "https:" ||
    preview.username ||
    preview.password ||
    preview.port ||
    !["p.scdn.co"].includes(preview.hostname)
  )
    throw new Error("Unsupported verification preview");
  const sandbox = await Sandbox.create({
    runtime: "node22",
    timeout: 600000,
    ...(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID && process.env.VERCEL_TEAM_ID
      ? {
          token: process.env.VERCEL_TOKEN,
          projectId: process.env.VERCEL_PROJECT_ID,
          teamId: process.env.VERCEL_TEAM_ID,
        }
      : {}),
  });
  try {
    const install = await sandbox.runCommand({
      cmd: "dnf",
      args: ["install", "-y", "python3.11", "python3.11-pip"],
      sudo: true,
    });
    if (install.exitCode !== 0) throw new Error("Audio worker Python installation failed");
    const packages = await sandbox.runCommand("python3.11", [
      "-m",
      "pip",
      "install",
      "--target",
      "/tmp/audio-packages",
      "yt-dlp[default]==2026.08.19",
      "numpy==2.3.3",
      "imageio-ffmpeg==0.6.0",
    ]);
    if (packages.exitCode !== 0) throw new Error("Audio worker dependency installation failed");
    await sandbox.writeFiles([
      { path: "input.json", content: Buffer.from(JSON.stringify(data)) },
      { path: "acquire.py", content: Buffer.from(verifiedAudioWorker) },
    ]);
    const run = await sandbox.runCommand({
      cmd: "python3.11",
      args: ["acquire.py"],
      env: { PYTHONPATH: "/tmp/audio-packages" },
    });
    if (run.exitCode !== 0)
      throw new Error("Full audio acquisition or waveform verification failed");
    const [file, manifest] = await Promise.all([
      sandbox.readFileToBuffer({ path: "audio.wav" }),
      sandbox.readFileToBuffer({ path: "result.json" }),
    ]);
    if (!file || file.length > 40000000 || !manifest)
      throw new Error("Audio worker output unavailable");
    const result = z
      .object({
        youtubeUrl: z.string().regex(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        durationSeconds: z.number().positive().max(1200),
        verification: z.object({
          method: z.literal("waveform-cross-correlation"),
          correlation: z.number().min(0.95).max(1),
          previewSeconds: z.number().min(15),
          offsetSeconds: z.number().nonnegative(),
        }),
      })
      .parse(JSON.parse(manifest.toString()));
    return { file, ...result };
  } finally {
    await sandbox.stop();
  }
}
