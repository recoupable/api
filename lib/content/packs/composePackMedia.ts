import type { PackLyricAudioEvidence } from "./lyrics/packLyricRenderTypes";
import { createHash } from "node:crypto";
import { buildPackLyricRenderPlan } from "./lyrics/buildPackLyricRenderPlan";
import { withPackLyricRuntime } from "./lyrics/withPackLyricRuntime";
import { renderPackLyricOverlay } from "./lyrics/renderPackLyricOverlay";
import { validatePackLyricProbe } from "./lyrics/validatePackLyricProbe";
import {
  PACK_LYRIC_FONT_SHA256,
  type PackLyricMediaCapability,
  type PackMediaRuntime,
  type PackLyricRuntime,
} from "./lyrics/packLyricRenderTypes";
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
    lyrics?: unknown;
  },
  lyricCapability?: PackLyricMediaCapability,
): Promise<PackComposition> {
  const requested = input.lyrics !== undefined;
  if (requested && !lyricCapability) throw new Error("lyric_renderer_unavailable");
  const lyricPlan = requested
    ? buildPackLyricRenderPlan(
        input.lyrics,
        input.start,
        input.seconds,
        lyricCapability!.rendererBuildSha256,
      )
    : undefined;
  if (lyricPlan && (input.visualizer || (!input.motion && !input.images[0])))
    throw new Error("Unsupported lyric visual mode");
  if (
    lyricPlan &&
    (!Buffer.isBuffer(lyricCapability!.fontBytes) ||
      createHash("sha256").update(lyricCapability!.fontBytes).digest("hex") !==
        PACK_LYRIC_FONT_SHA256)
  )
    throw new Error("Unqualified lyric font");
  const fetchMedia = lyricPlan ? lyricCapability!.fetchMedia : fetchPackMedia;
  const storeFile = lyricPlan ? lyricCapability!.storeFile : storePackFile;
  const runMedia = <T>(
    run: (sandbox: PackMediaRuntime, ffmpeg: string, ffprobe: string) => Promise<T>,
  ) => (lyricPlan ? withPackLyricRuntime(lyricCapability, run) : withPackMediaRuntime(run));
  let lyricOutput: Buffer | undefined;
  if (!requested && !input.motion && !input.visualizer) {
    const files = [];
    for (const url of input.images) {
      const media = await fetchPackMedia(url);
      const parsed = validatePackMediaBytes(media.bytes, media.contentType);
      files.push(await storePackFile(ownerId, media.bytes, parsed.contentType));
    }
    return { files, probe: {} };
  }
  const loadSources = async () => {
    const [audio, visual] = await Promise.all([
      fetchMedia(input.audioUrl),
      fetchMedia(input.motion ?? input.images[0]),
    ]);
    validatePackMediaBytes(audio.bytes, audio.contentType);
    validatePackMediaBytes(visual.bytes, visual.contentType);
    if (lyricPlan) {
      if (
        audio.bytes.length > 50 * 1024 * 1024 ||
        visual.bytes.length > 50 * 1024 * 1024 ||
        !audio.contentType.startsWith("audio/") ||
        !visual.contentType.startsWith(input.motion ? "video/" : "image/")
      )
        throw new Error("Invalid bounded lyric source media");
      if (
        createHash("sha256").update(audio.bytes).digest("hex") !==
        lyricPlan.timeline.target.recording.sha256
      )
        throw new Error("Lyric recording hash mismatch");
    }
    return { audio, visual };
  };
  const loaded = lyricPlan ? undefined : await loadSources();
  const result = await runMedia(async (sandbox, ffmpeg, ffprobe) => {
    const { audio, visual } = loaded ?? (await loadSources());
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
      !lyricPlan &&
      (!source.streams?.some((s: { codec_type: string }) => s.codec_type === "audio") ||
        !Number.isFinite(Number(source.format?.duration)) ||
        Number(source.format.duration) < input.start + input.seconds)
    )
      throw new Error("Selected song excerpt is shorter than the requested asset");
    let audioIndex = 0;
    let sourceAudio: PackLyricAudioEvidence | undefined;
    if (lyricPlan) {
      sourceAudio = validatePackLyricProbe(source, {
        kind: "source",
        durationMs: lyricPlan.timeline.target.recording.durationMs,
        endMs: lyricPlan.timeline.target.excerpt.endMs,
      });
      audioIndex = sourceAudio.audioIndex;
      const visualProbe = await sandbox.runCommand(ffprobe, [
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        "source-visual",
      ]);
      if (visualProbe.exitCode !== 0) throw new Error("Cannot probe lyric visual");
      validatePackLyricProbe(JSON.parse(await visualProbe.stdout()), {
        kind: "visual",
        still: !input.motion,
      });
    }
    const overlay = lyricPlan
      ? await renderPackLyricOverlay(sandbox as PackLyricRuntime, ffmpeg, ffprobe, lyricPlan)
      : undefined;
    const base = input.motion ? ["-i", "source-visual"] : ["-loop", "1", "-i", "source-visual"];
    const filter = lyricPlan
      ? `[0:v]setpts=PTS-STARTPTS,fps=fps=30:start_time=0,settb=1/30,setpts=N,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];[2:v]settb=1/30,setpts=N,format=bgra[words];[bg][words]overlay=108:816:repeatlast=0:eof_action=pass[v];[1:${audioIndex}]atrim=duration=${lyricPlan.durationSeconds},asetpts=PTS-STARTPTS[lyric-audio]`
      : input.visualizer
        ? "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];[1:a]asplit=2[a][wave];[wave]showwaves=s=864x160:mode=cline:colors=white:rate=30[viz];[bg][viz]overlay=108:1450[v]"
        : "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[v]";
    const args = [
      "-y",
      ...base,
      "-ss",
      lyricPlan?.startSeconds ?? String(input.start),
      "-i",
      "source-audio",
      ...(overlay?.inputArgs ?? []),
      "-filter_complex",
      filter,
      "-map",
      "[v]",
      "-map",
      lyricPlan ? "[lyric-audio]" : input.visualizer ? "[a]" : "1:a:0",
      "-t",
      lyricPlan ? (lyricPlan.frames / 30).toFixed(9) : String(input.seconds),
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
      ...(sourceAudio
        ? ["-ar", String(sourceAudio.sampleRate), "-ac", String(sourceAudio.channels)]
        : []),
      "-movflags",
      "+faststart",
      ...(lyricPlan
        ? ["-threads", "1", "-frames:v", String(lyricPlan.frames), "-fs", String(50 * 1024 * 1024)]
        : []),
      "output.mp4",
    ];
    const composed = await sandbox.runCommand(ffmpeg, args);
    if (composed.exitCode !== 0) throw new Error("Song composition failed");
    const checked = await sandbox.runCommand(ffprobe, [
      ...(lyricPlan ? ["-count_frames"] : []),
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
    if (lyricPlan)
      validatePackLyricProbe(probe, {
        kind: "output",
        durationMs:
          lyricPlan.timeline.target.excerpt.endMs - lyricPlan.timeline.target.excerpt.startMs,
        frames: lyricPlan.frames,
        sourceAudio: sourceAudio!,
      });
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
    if (lyricPlan) lyricOutput = bytes;
    return {
      files: lyricPlan ? [] : [await storeFile(ownerId, bytes, "video/mp4")],
      probe: {
        duration,
        audio: true,
        width: video.width,
        height: video.height,
        audio_source: "supplied-recording",
        audio_start_seconds: input.start,
        ...(lyricPlan
          ? {
              lyric_plan_digest: lyricPlan.digest,
              lyric_plan_payload: lyricPlan.payload,
              lyric_render_resources: overlay,
              audio_stream_index: audioIndex,
              selected_audio: sourceAudio,
              output_audio_policy: "aac-preserve-source-sample-rate-and-channels",
              visual_sha256: createHash("sha256").update(visual.bytes).digest("hex"),
              lyric_scope: "local-injected-only",
            }
          : {}),
      },
    };
  });
  // Qualified runtime cleanup must succeed before the injected store is reached.
  if (lyricPlan) {
    if (!lyricOutput) throw new Error("Missing lyric output");
    result.files = [await storeFile(ownerId, lyricOutput, "video/mp4")];
  }
  return result;
}
