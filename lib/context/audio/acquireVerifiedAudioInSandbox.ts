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
export async function acquireVerifiedAudioInSandbox(
  input: z.input<typeof inputSchema>,
  download: (videoId: string) => Promise<Buffer | null>,
) {
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
    const discovery = await sandbox.runCommand({
      cmd: "python3.11",
      args: ["acquire.py", "discover"],
      env: { PYTHONPATH: "/tmp/audio-packages" },
    });
    if (discovery.exitCode !== 0) {
      console.error("[sites:audio-worker]", (await discovery.stderr()).slice(-4000));
      throw new Error("Audio candidate discovery failed");
    }
    const candidatesFile = await sandbox.readFileToBuffer({ path: "candidates.json" });
    const candidates = z
      .array(
        z.object({
          id: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
          title: z.string().max(500),
          duration: z.number().positive().max(1202),
          channel: z.string().nullable().optional(),
        }),
      )
      .max(3)
      .parse(JSON.parse(candidatesFile?.toString() ?? "[]"));
    if (!candidates.length)
      throw new Error("No matching YouTube recording found after exact and broad searches");
    let matched = false;
    for (const candidate of candidates) {
      const source = await download(candidate.id);
      if (!source) continue;
      await sandbox.writeFiles([
        { path: "candidate.mp3", content: source },
        { path: "candidate.json", content: Buffer.from(JSON.stringify(candidate)) },
      ]);
      const verification = await sandbox.runCommand({
        cmd: "python3.11",
        args: ["acquire.py", "verify"],
        env: { PYTHONPATH: "/tmp/audio-packages" },
      });
      if (verification.exitCode === 0) {
        matched = true;
        break;
      }
      console.error("[sites:audio-worker]", (await verification.stderr()).slice(-4000));
    }
    if (!matched) throw new Error("No hosted audio passed recording verification");
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
