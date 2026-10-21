import { withPackMediaRuntime } from "./withPackMediaRuntime";
import { fetchPackMedia } from "./fetchPackMedia";
import { validatePackMediaBytes } from "./validatePackMediaBytes";
import { storePackFile } from "./storePackFile";
import type { PackComposition } from "./producePackAsset";
/** Render and probe the exact supplied song excerpt. No artist repo, shell interpolation or public output. */
export async function composePackMedia(
  ownerId: string,
  input: {
    images: string[];
    motion?: string;
    audioUrl: string;
    start: number;
    seconds: number;
    visualizer: boolean;
  },
): Promise<PackComposition> {
  if (!input.motion && !input.visualizer) {
    const files = [];
    for (const url of input.images) {
      const media = await fetchPackMedia(url);
      const parsed = validatePackMediaBytes(media.bytes, media.contentType);
      files.push(await storePackFile(ownerId, media.bytes, parsed.contentType));
    }
    return { files, probe: {} };
  }
  const [audio, visual] = await Promise.all([
    fetchPackMedia(input.audioUrl),
    fetchPackMedia(input.motion ?? input.images[0]),
  ]);
  validatePackMediaBytes(audio.bytes, audio.contentType);
  validatePackMediaBytes(visual.bytes, visual.contentType);
  return withPackMediaRuntime(async (sandbox, ffmpeg, ffprobe) => {
    await sandbox.writeFiles([
      { path: "source-audio", content: audio.bytes },
      { path: "source-visual", content: visual.bytes },
    ]);
    const sourceProbe = await sandbox.runCommand(ffprobe, [
      "-v",
      "error",
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      "source-audio",
    ]);
    if (sourceProbe.exitCode !== 0) throw new Error("Cannot decode supplied song audio");
    const source = JSON.parse(await sourceProbe.stdout());
    if (
      !source.streams?.some((s: { codec_type: string }) => s.codec_type === "audio") ||
      !Number.isFinite(Number(source.format?.duration)) ||
      Number(source.format.duration) < input.start + input.seconds
    )
      throw new Error("Selected song excerpt is shorter than the requested asset");
    const base = input.motion ? ["-i", "source-visual"] : ["-loop", "1", "-i", "source-visual"];
    const filter = input.visualizer
      ? "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];[1:a]asplit=2[a][wave];[wave]showwaves=s=864x160:mode=cline:colors=white:rate=30[viz];[bg][viz]overlay=108:1450[v]"
      : "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[v]";
    const args = [
      "-y",
      ...base,
      "-ss",
      String(input.start),
      "-i",
      "source-audio",
      "-filter_complex",
      filter,
      "-map",
      "[v]",
      "-map",
      input.visualizer ? "[a]" : "1:a:0",
      "-t",
      String(input.seconds),
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "21",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      "output.mp4",
    ];
    const composed = await sandbox.runCommand(ffmpeg, args);
    if (composed.exitCode !== 0) throw new Error("Song composition failed");
    const checked = await sandbox.runCommand(ffprobe, [
      "-v",
      "error",
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      "output.mp4",
    ]);
    if (checked.exitCode !== 0) throw new Error("Final media probe failed");
    const probe = JSON.parse(await checked.stdout());
    const video = probe.streams?.find((s: { codec_type: string }) => s.codec_type === "video");
    const duration = Number(probe.format?.duration);
    const hasAudio = probe.streams?.some((s: { codec_type: string }) => s.codec_type === "audio");
    if (
      !hasAudio ||
      !video ||
      Math.abs(duration - input.seconds) > 0.3 ||
      video.width !== 1080 ||
      video.height !== 1920
    )
      throw new Error("Final media failed audio, duration or dimensions check");
    const bytes = await sandbox.readFileToBuffer({ path: "output.mp4" });
    if (!bytes || bytes.length > 50 * 1024 * 1024) throw new Error("Invalid composed output size");
    return {
      files: [await storePackFile(ownerId, bytes, "video/mp4")],
      probe: {
        duration,
        audio: true,
        width: video.width,
        height: video.height,
        audio_source: "supplied-recording",
        audio_start_seconds: input.start,
      },
    };
  });
}
