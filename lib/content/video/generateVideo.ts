import type { z } from "zod";
import fal from "@/lib/fal/server";
import type { createVideoBodySchema } from "./validateCreateVideoBody";
import { buildVideoInput } from "./buildVideoInput";

// Owner ruling 2026-08-31: MiniMax H3 Max is the house video model. Ids
// verified against fal 2026-09-02. Not caller-overridable — cost is only
// predictable if the model is ours (recoupable/app#2052). Lipsync/OmniHuman
// is out of this endpoint's scope for now (docs#328, 2026-09-03).
const HOUSE_VIDEO_MODEL = "minimax/h3-max/image-to-video";

type VideoParams = z.infer<typeof createVideoBodySchema>;

export interface GenerateVideoResult {
  videoUrl: string;
}

/**
 * Generate a video using MiniMax H3 Max via fal.
 *
 * @param validated - Validated video generation parameters.
 * @returns Object with the video URL.
 * @throws Error if the generation returns no video.
 */
export async function generateVideo(validated: VideoParams): Promise<GenerateVideoResult> {
  const input = buildVideoInput(validated);

  const result = await fal.subscribe(HOUSE_VIDEO_MODEL, { input });
  const resultData = result.data as Record<string, unknown>;
  const videoUrl = (resultData?.video as Record<string, unknown>)?.url as string | undefined;

  if (!videoUrl) {
    throw new Error("Video generation returned no video");
  }

  return { videoUrl };
}
