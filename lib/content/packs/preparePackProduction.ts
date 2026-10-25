import { assertPackQuoteConfiguration } from "./assertPackQuoteConfiguration";
import { packExecutionSettings } from "@/lib/const";
import { z } from "zod";
import { createHash } from "node:crypto";
import { fetchPackMedia } from "./fetchPackMedia";
import { validatePackMediaBytes } from "./validatePackMediaBytes";
import { withPackMediaRuntime } from "./withPackMediaRuntime";
import { callFlamingoGenerate } from "@/lib/flamingo/callFlamingoGenerate";
import { flamingoGenerateBodySchema } from "@/lib/flamingo/flamingoGenerateBodySchema";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import { resolvePackCreativeContext } from "./resolvePackCreativeContext";
import { createSignedFileUrlByKey } from "@/lib/supabase/storage/createSignedFileUrlByKey";
import type { PackActor, PackJob } from "./packTypes";
const contextSchema = z.object({
  state: z.literal("complete"),
  audio: z.object({ storage_key: z.string() }),
  references: z.array(z.object({ storage_key: z.string() })),
  summary: z.string(),
  visual_direction: z.string(),
  proposed_start_seconds: z.number(),
  selected_start_seconds: z.number(),
  duration_seconds: z.number(),
});
/** Import the exact source, listen once, and persist a labeled excerpt proposal before paid visual calls. */
export async function preparePackProduction(actor: PackActor, job: PackJob): Promise<PackJob> {
  job = { ...job, brief: resolvePackCreativeContext(job.brief) };
  let context = contextSchema.safeParse(job.production_context);
  if (!context.success) {
    assertPackQuoteConfiguration(job.quote);
    if ((job.production_context as { state?: string } | undefined)?.state === "analyzing")
      throw new Error(
        "Audio analysis outcome is uncertain; retained context needs reconciliation before production",
      );
    const sources = job.quote?.sources;
    if (!sources)
      throw new Error("The approved quote has no immutable source snapshot; get a new estimate");
    for (const file of [sources.audio, ...sources.references])
      if (!file.storage_key.startsWith(`${job.owner_id}/release-packs/`))
        throw new Error("Source snapshot ownership mismatch");
    const audioUrl = await createSignedFileUrlByKey({
      key: sources.audio.storage_key,
      expiresInSeconds: 86400,
    });
    const source = await fetchPackMedia(audioUrl);
    validatePackMediaBytes(source.bytes, sources.audio.content_type);
    if (createHash("sha256").update(source.bytes).digest("hex") !== sources.audio.sha256)
      throw new Error("Approved recording snapshot checksum changed; no generation started");
    const duration = await withPackMediaRuntime(async (sandbox, _ffmpeg, ffprobe) => {
      await sandbox.writeFiles([{ path: "song", content: source.bytes }]);
      const result = await sandbox.runCommand(ffprobe, [
        "-v",
        "error",
        "-show_format",
        "-show_streams",
        "-of",
        "json",
        "song",
      ]);
      if (result.exitCode !== 0) throw new Error("Cannot decode supplied song audio");
      const data = JSON.parse(await result.stdout());
      const seconds = Number(data.format?.duration);
      if (
        !data.streams?.some((s: { codec_type: string }) => s.codec_type === "audio") ||
        !Number.isFinite(seconds) ||
        seconds > 1200 ||
        seconds < job.deliverables.video_seconds
      )
        throw new Error(
          "Song must be decodable audio between the requested clip length and 20 minutes",
        );
      return seconds;
    });
    if (
      job.brief.audio_start_seconds !== undefined &&
      job.brief.audio_start_seconds + job.deliverables.video_seconds > duration
    )
      throw new Error("Selected song excerpt runs past the supplied recording");
    const audio = { ...sources.audio, url: audioUrl };
    const references = sources.references;
    await runPackCommand(actor, "context", job.id, {
      value: { state: "analyzing", audio, references, duration_seconds: duration },
    });
    assertPackQuoteConfiguration(job.quote);
    const analysis = await callFlamingoGenerate(
      flamingoGenerateBodySchema.parse({
        audio_url: audio.url,
        prompt: `Listen to this supplied recording (${duration.toFixed(2)} seconds). Describe audible mood, instrumentation, energy, texture and a useful visual direction without quoting or inventing lyrics. Propose one strong ${job.deliverables.video_seconds}-second music excerpt start time within 0 and ${Math.max(0, duration - job.deliverables.video_seconds).toFixed(2)} seconds. Timing is a creative proposal, not verified transcription. Campaign occasion: ${job.brief.occasion}; artist: ${job.brief.artist_name}; song: ${job.brief.song_title}; customer direction: ${job.brief.creative_direction ?? "propose one unified artwork-led direction"}; constraints: ${job.brief.constraints.join("; ")}. Return ONLY JSON {"summary":"audible observations with uncertainty","visual_direction":"one cohesive proposed art direction with a specific palette, materials, lighting and typography; no invented artist face","proposed_start_seconds":number}.`,
        ...packExecutionSettings.analysis,
      }),
      { signal: AbortSignal.timeout(90_000) },
    );
    let raw: unknown;
    try {
      raw = JSON.parse(analysis.response.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      throw new Error(
        "Audio analysis did not return a usable bounded excerpt proposal; no visual generation started",
      );
    }
    const interpreted = z
      .object({
        summary: z.string().min(1).max(6000),
        visual_direction: z.string().min(1).max(2000),
        proposed_start_seconds: z
          .number()
          .min(0)
          .max(duration - job.deliverables.video_seconds),
      })
      .parse(raw);
    const value = {
      state: "complete",
      audio,
      references,
      summary: interpreted.summary,
      visual_direction: interpreted.visual_direction,
      proposed_start_seconds: interpreted.proposed_start_seconds,
      selected_start_seconds: job.brief.audio_start_seconds ?? interpreted.proposed_start_seconds,
      duration_seconds: duration,
    };
    await runPackCommand(actor, "context", job.id, { value });
    context = contextSchema.safeParse(value);
  }
  if (!context.success) throw new Error("Production context unavailable");
  const value = context.data;
  for (const file of [value.audio, ...value.references])
    if (!file.storage_key.startsWith(`${job.owner_id}/release-packs/`))
      throw new Error("Production source ownership mismatch");
  return {
    ...job,
    brief: {
      ...job.brief,
      creative_direction:
        job.brief.creative_direction ??
        `Proposed from supplied recording: ${value.visual_direction}`,
      audio_url: await createSignedFileUrlByKey({
        key: value.audio.storage_key,
        expiresInSeconds: 86400,
      }),
      audio_start_seconds: value.selected_start_seconds,
      reference_image_urls: await Promise.all(
        value.references.map(file =>
          createSignedFileUrlByKey({ key: file.storage_key, expiresInSeconds: 86400 }),
        ),
      ),
      song_summary:
        `Supplied recording analysis (model interpretation, not verified lyrics): ${value.summary}\nCustomer context: ${job.brief.song_summary ?? "none"}`.slice(
          0,
          8000,
        ),
    },
  };
}
