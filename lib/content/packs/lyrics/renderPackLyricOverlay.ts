import sharp from "sharp";
import type { buildPackLyricRenderPlan } from "./buildPackLyricRenderPlan";
import type { PackLyricRuntime } from "./packLyricRenderTypes";
/** Serial measured plates and finite FFV1 segments: one decoded plate/process, never 128 overlay inputs. */
export async function renderPackLyricOverlay(
  runtime: PackLyricRuntime,
  ffmpeg: string,
  ffprobe: string,
  plan: ReturnType<typeof buildPackLyricRenderPlan>,
) {
  let plateBytes = 0,
    segmentBytes = 0,
    frame = 0;
  const segments: string[] = [];
  const execute = async (command: string, args: string[]) => {
    const result = await runtime.runCommand(command, args);
    if (result.exitCode !== 0)
      throw new Error("Lyric render command failed", { cause: await result.stdout() });
    return result;
  };
  const segment = async (png: Buffer, frames: number) => {
    plateBytes += png.length;
    if (plateBytes > 16 * 1024 * 1024 || segments.length >= 257)
      throw new Error("Lyric plate/segment bound exceeded");
    const name = `lyric-segment-${segments.length}.mkv`;
    await runtime.writeFiles([{ path: "lyric-plate.png", content: png }]);
    await execute(ffmpeg, [
      "-v",
      "error",
      "-y",
      "-loop",
      "1",
      "-framerate",
      "30",
      "-i",
      "lyric-plate.png",
      "-frames:v",
      String(frames),
      "-an",
      "-c:v",
      "ffv1",
      "-level",
      "3",
      "-pix_fmt",
      "bgra",
      "-threads",
      "1",
      "-fs",
      String(256 * 1024 * 1024 - segmentBytes),
      name,
    ]);
    const size = await runtime.fileSize(name);
    segmentBytes += size;
    if (!Number.isSafeInteger(size) || size <= 0 || segmentBytes > 256 * 1024 * 1024)
      throw new Error("Lyric intermediate byte bound exceeded");
    const probe = await execute(ffprobe, [
      "-v",
      "error",
      "-count_frames",
      "-show_streams",
      "-of",
      "json",
      name,
    ]);
    const parsed: unknown = JSON.parse(await probe.stdout());
    const streams =
      parsed && typeof parsed === "object" && "streams" in parsed ? parsed.streams : undefined;
    const first: unknown = Array.isArray(streams) ? streams[0] : undefined;
    const video =
      first && typeof first === "object" ? (first as Record<string, unknown>) : undefined;
    if (video?.width !== 864 || video?.height !== 288 || Number(video?.nb_read_frames) !== frames)
      throw new Error("Lyric segment frame/geometry mismatch");
    segments.push(name);
    await runtime.removeFiles(["lyric-plate.png"]);
  };
  const gap = async (frames: number) => {
    if (frames > 0)
      await segment(
        await sharp({
          create: {
            width: 864,
            height: 288,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          },
        })
          .png()
          .toBuffer(),
        frames,
      );
  };
  for (const cue of plan.cues) {
    await gap(cue.startFrame - frame);
    await runtime.writeFiles([{ path: "lyric-word.txt", content: Buffer.from(cue.text, "utf8") }]);
    await execute(ffmpeg, [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=16384x256:r=1",
      "-vf",
      "drawtext=fontfile=lyric-font.ttf:textfile=lyric-word.txt:expansion=none:fontsize=64:fontcolor=white:x=64:y=64",
      "-frames:v",
      "1",
      "-threads",
      "1",
      "-fs",
      "2097152",
      "lyric-scratch.png",
    ]);
    if ((await runtime.fileSize("lyric-scratch.png")) > 2 * 1024 * 1024)
      throw new Error("Lyric scratch encoded bound exceeded");
    const png = await runtime.readFileToBuffer({ path: "lyric-scratch.png" });
    if (!png) throw new Error("Missing lyric raster");
    const image = sharp(png, { limitInputPixels: 16384 * 256 });
    const metadata = await image.metadata();
    if (metadata.width !== 16384 || metadata.height !== 256)
      throw new Error("Lyric scratch dimensions invalid");
    const pixels = await image.clone().greyscale().raw().toBuffer();
    let left = 16384,
      right = 0,
      top = 256,
      bottom = 0;
    for (let n = 0; n < pixels.length; n++)
      if (pixels[n] > 16) {
        const x = n % 16384,
          y = Math.floor(n / 16384);
        left = Math.min(left, x);
        right = Math.max(right, x + 1);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y + 1);
      }
    const width = right - left,
      height = bottom - top;
    if (
      width <= 0 ||
      height <= 0 ||
      left <= 0 ||
      top <= 0 ||
      right >= 16384 ||
      bottom >= 256 ||
      width > 864 ||
      height > 288
    )
      throw new Error("Lyric glyph raster empty, clipped or exceeds safe box");
    const padX = Math.floor((864 - width) / 2),
      padY = Math.floor((288 - height) / 2);
    const plate = await image
      .extract({ left, top, width, height })
      .ensureAlpha()
      .extend({
        left: padX,
        right: 864 - width - padX,
        top: padY,
        bottom: 288 - height - padY,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      })
      .png()
      .toBuffer();
    await segment(plate, cue.endFrame - cue.startFrame);
    frame = cue.endFrame;
    await runtime.removeFiles(["lyric-word.txt", "lyric-scratch.png"]);
  }
  await gap(plan.frames - frame);
  await runtime.writeFiles([
    {
      path: "lyric-segments.ffconcat",
      content: Buffer.from(
        "ffconcat version 1.0\n" + segments.map(name => `file '${name}'`).join("\n") + "\n",
      ),
    },
  ]);
  return {
    inputArgs: ["-f", "concat", "-safe", "1", "-i", "lyric-segments.ffconcat"],
    segmentCount: segments.length,
    plateBytes,
    segmentBytes,
  };
}
