import type { z } from "zod";
import fal from "@/lib/fal/server";
import type { createVideoBodySchema } from "@/lib/content/schemas";
import { loadTemplate } from "@/lib/content/templates";
import { inferMode } from "./inferMode";
import { buildFalInput } from "./buildFalInput";

const MODELS: Record<string, string> = {
  prompt: "fal-ai/veo3.1",
  animate: "fal-ai/veo3.1/image-to-video",
  reference: "fal-ai/veo3.1/reference-to-video",
  extend: "fal-ai/veo3.1/extend-video",
  "first-last": "fal-ai/veo3.1/first-last-frame-to-video",
  lipsync: "fal-ai/ltx-2-19b/audio-to-video",
};

type VideoParams = z.infer<typeof createVideoBodySchema>;

export interface GenerateVideoResult {
  videoUrl: string;
  mode: string;
}

/**
 * Generate a video using the fal API.
 *
 * @param validated - Validated video generation parameters.
 * @returns Object with the video URL and resolved mode.
 * @throws Error if the generation returns no video.
 */
export async function generateVideo(validated: VideoParams): Promise<GenerateVideoResult> {
  const tpl = validated.template ? loadTemplate(validated.template) : null;

  let promptOverride = validated.prompt;
  if (!promptOverride && tpl?.video) {
    const parts: string[] = [];
    if (tpl.video.movements.length) {
      parts.push(tpl.video.movements[Math.floor(Math.random() * tpl.video.movements.length)]);
    }
    if (tpl.video.moods.length) {
      parts.push(tpl.video.moods[Math.floor(Math.random() * tpl.video.moods.length)]);
    }
    if (parts.length) promptOverride = parts.join(". ");
  }

  const mode = validated.mode ?? inferMode(validated);
  const model = validated.model ?? MODELS[mode] ?? MODELS.prompt;
  const input = buildFalInput(mode, { ...validated, prompt: promptOverride ?? validated.prompt });

  const result = await fal.subscribe(model, { input });
  const resultData = result.data as Record<string, unknown>;
  const videoUrl = (resultData?.video as Record<string, unknown>)?.url as string | undefined;

  if (!videoUrl) {
    throw new Error("Video generation returned no video");
  }

  return { videoUrl, mode };
}
