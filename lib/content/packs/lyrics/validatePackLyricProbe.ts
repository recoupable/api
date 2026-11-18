import type { PackLyricAudioEvidence } from "./packLyricRenderTypes";
type ProbeMode =
  | { kind: "source"; durationMs: number; endMs: number }
  | { kind: "visual"; still?: boolean }
  | { kind: "output"; durationMs: number; frames: number; sourceAudio: PackLyricAudioEvidence };
/** Refuse ambiguous/invalid metadata. Audio stream zero is authoritative; container duration is not. */
export function validatePackLyricProbe(
  input: unknown,
  mode: Exclude<ProbeMode, { kind: "visual" }>,
): PackLyricAudioEvidence;
export function validatePackLyricProbe(
  input: unknown,
  mode: { kind: "visual"; still?: boolean },
): void;
export function validatePackLyricProbe(
  input: unknown,
  mode: ProbeMode,
): PackLyricAudioEvidence | void {
  const probe = input as { streams?: Record<string, unknown>[]; format?: { duration?: unknown } };
  const number = (value: unknown) => {
    if (
      (typeof value !== "number" &&
        (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value))) ||
      !Number.isFinite(Number(value))
    )
      throw new Error("Invalid finite probe metadata");
    return Number(value);
  };
  const integer = (value: unknown, min = 1) => {
    const n = number(value);
    if (!Number.isSafeInteger(n) || n < min) throw new Error("Invalid integer probe metadata");
    return n;
  };
  const rational = (value: unknown) => {
    if (typeof value !== "string" || !/^\d+\/\d+$/.test(value))
      throw new Error("Invalid probe timebase/rate");
    const [a, b] = value.split("/").map(v => integer(v));
    return { a, b };
  };
  if (!probe || !Array.isArray(probe.streams)) throw new Error("Missing probe streams");
  const timing = (stream: Record<string, unknown>) => {
    const start = number(stream.start_time);
    const ticks = integer(stream.duration_ts);
    const tb = rational(stream.time_base);
    if (start < 0) throw new Error("Unsupported negative stream timestamp");
    return { start, numerator: BigInt(ticks) * BigInt(tb.a) * 1000n, denominator: BigInt(tb.b) };
  };
  if (mode.kind !== "source") {
    const video = probe.streams.find(s => s.codec_type === "video");
    if (!video) throw new Error("Missing video stream");
    const width = integer(video.width),
      height = integer(video.height),
      rate = rational(video.avg_frame_rate);
    if (width * height > 1080 * 1920 || rate.a / rate.b > 120)
      throw new Error("Visual decode bounds exceeded");
    if (mode.kind === "visual") {
      // Visual PTS may be nonzero/VFR. Normalize before evaluation; count final decoded frames.
      if (!mode.still) {
        number(video.start_time);
        rational(video.time_base);
      }
      return;
    }
    const videoTiming = timing(video);
    if (
      videoTiming.start !== 0 ||
      Math.abs(
        Number(videoTiming.numerator) / Number(videoTiming.denominator) - (mode.frames * 1000) / 30,
      ) > 0.1
    )
      throw new Error("Inconsistent final video duration/origin");
    if (
      width !== 1080 ||
      height !== 1920 ||
      rate.a !== 30 * rate.b ||
      integer(video.nb_read_frames) !== mode.frames
    )
      throw new Error("Invalid final frame geometry/count/rate");
  }
  const audio = probe.streams.find(s => s.codec_type === "audio");
  if (!audio) throw new Error("Missing selected audio stream");
  const sampleRate = integer(audio.sample_rate),
    channels = integer(audio.channels),
    audioIndex = integer(audio.index, 0);
  if (sampleRate > 192000 || channels > 8) throw new Error("Audio decode bounds exceeded");
  const codec = audio.codec_name;
  if (typeof codec !== "string" || !/^[a-zA-Z0-9_]+$/.test(codec))
    throw new Error("Invalid audio codec metadata");
  const duration = timing(audio);
  if (mode.kind === "source") {
    if (duration.start !== 0) throw new Error("Unsupported nonzero audio stream origin");
    const rounded = (duration.numerator * 2n + duration.denominator) / (duration.denominator * 2n);
    if (
      rounded !== BigInt(mode.durationMs) ||
      BigInt(mode.endMs) * duration.denominator > duration.numerator
    )
      throw new Error("Selected audio duration/excerpt mismatch");
    if (
      audio.duration !== undefined &&
      Math.abs(
        number(audio.duration) * 1000 - Number(duration.numerator) / Number(duration.denominator),
      ) >
        1000 / sampleRate
    )
      throw new Error("Audio duration differs by more than one sample");
  } else {
    if (
      codec !== "aac" ||
      sampleRate !== mode.sourceAudio.sampleRate ||
      channels !== mode.sourceAudio.channels
    )
      throw new Error("Final audio format differs from selected source policy");
    const tolerance = Math.max(1000 / 30, (1024 * 1000) / sampleRate);
    if (duration.start !== 0) throw new Error("Invalid final audio origin");
    const outputMs = number(probe.format?.duration) * 1000;
    if (
      outputMs <= 0 ||
      Math.abs(outputMs - mode.durationMs) > tolerance ||
      Math.abs(Number(duration.numerator) / Number(duration.denominator) - mode.durationMs) >
        tolerance
    )
      throw new Error("Invalid final audio/video duration");
  }
  return {
    audioIndex,
    sampleRate,
    channels,
    codec,
    timeBase: String(audio.time_base),
    startTime: duration.start,
    durationTicks: integer(audio.duration_ts),
    durationMsNumerator: String(duration.numerator),
    durationMsDenominator: String(duration.denominator),
  };
}
