import { generateText } from "ai";
import { LIGHTWEIGHT_MODEL } from "@/lib/const";
import { buildImageInput } from "@/lib/content/image/buildImageInput";
import { buildVideoInput } from "@/lib/content/video/buildVideoInput";
import { HOUSE_VIDEO_MODEL } from "@/lib/content/video/generateVideo";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import { creditCostForImageUnits } from "@/lib/content/creditCostForImageUnits";
import { creditCostForVideoUnits } from "@/lib/content/creditCostForVideoUnits";
import { estimateVideoUnits } from "@/lib/content/estimateVideoUnits";
import { runPackFalRequest } from "./runPackFalRequest";
import { composePackMedia } from "./composePackMedia";
import { inspectPackMedia } from "./inspectPackMedia";
import type { PackActor, PackAsset, PackJob } from "./packTypes";
import type { PackProductionServices } from "./producePackAsset";
/** Shared provider adapters; billing is exclusively the durable pack budget, never legacy handlers. */
export function createPackProductionServices(
  actor: PackActor,
  job: PackJob,
  asset: PackAsset,
): PackProductionServices {
  const state = asset.provider_state;
  const phase = async (name: string, value: unknown) => {
    await runPackCommand(actor, "phase", job.id, { asset_id: asset.id, phase: name, value });
    state[name] = value;
  };
  return {
    phase,
    generateImages: async (prompt, count) => {
      const images: string[] = [];
      for (let index = 0; index < count; index++) {
        const built = buildImageInput({
          prompt: `${prompt}\nSlide ${index + 1} of ${count}. ${count > 1 ? ["Open with the exact song title and a strong campaign idea.", "Develop the audible mood and artwork concept without inventing lyrics.", "Make the verified campaign occasion clear without inventing history.", "Close with the approved primary action and only the supplied destination URL."][index] : ""}`,
          num_images: 1,
          output_format: "png",
          sync_mode: false,
          aspect_ratio: "9:16",
          image_urls: job.brief.reference_image_urls,
        });
        const data = await runPackFalRequest({
          model: built.model,
          input: built.input,
          chargeCredits: creditCostForImageUnits(1),
          key: `image_submission_${index}`,
          state,
          save: phase,
        });
        const url = (data.images as { url?: string }[] | undefined)?.[0]?.url;
        if (!url) throw new Error("House image model returned no image");
        images.push(url);
      }
      return images;
    },
    generateMotion: async (prompt, image) => {
      const input = buildVideoInput({
        prompt,
        image_url: image,
        duration: job.deliverables.video_seconds,
        resolution: "768P",
        prompt_expansion_mode: "balanced",
        enable_safety_checker: true,
        sync_mode: false,
      });
      const data = await runPackFalRequest({
        model: HOUSE_VIDEO_MODEL,
        input,
        chargeCredits: creditCostForVideoUnits(
          estimateVideoUnits(job.deliverables.video_seconds, "768P"),
        ),
        key: "motion_submission",
        state,
        save: phase,
      });
      const url = (data.video as { url?: string } | undefined)?.url;
      if (!url) throw new Error("House video model returned no video");
      return url;
    },
    caption: async prompt => {
      const result = await generateText({
        model: LIGHTWEIGHT_MODEL,
        maxOutputTokens: 350,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(30_000),
        system:
          "Write one concise, distinctive music campaign caption grounded only in the brief. No invented quotes or facts. Return plain text only.",
        prompt,
      });
      const text = result.text.trim();
      if (!text) throw new Error("Caption generation returned no text");
      return text;
    },
    compose: input => composePackMedia(job.owner_id, input),
    inspect: inspectPackMedia,
    finish: result =>
      runPackCommand(actor, "finish_asset", job.id, { asset_id: asset.id, ...result }),
  };
}
