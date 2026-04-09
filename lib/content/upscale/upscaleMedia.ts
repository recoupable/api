import type { z } from "zod";
import fal from "@/lib/fal/server";
import type { createUpscaleBodySchema } from "./validateUpscaleBody";

type UpscaleParams = z.infer<typeof createUpscaleBodySchema>;

/**
 * Upscale an image or video using the fal seedvr model.
 *
 * @param validated - Validated upscale parameters.
 * @returns The upscaled media URL.
 * @throws Error if the upscale returns no result.
 */
export async function upscaleMedia(validated: UpscaleParams): Promise<string> {
  const model =
    validated.type === "video" ? "fal-ai/seedvr/upscale/video" : "fal-ai/seedvr/upscale/image";

  const inputKey = validated.type === "video" ? "video_url" : "image_url";

  const input: Record<string, unknown> = {
    [inputKey]: validated.url,
    upscale_factor: validated.upscale_factor,
  };
  if (validated.target_resolution) {
    input.upscale_mode = "target";
    input.target_resolution = validated.target_resolution;
  }

  const result = await fal.subscribe(model as string, { input });

  const resultData = result.data as Record<string, unknown>;
  const url =
    validated.type === "video"
      ? ((resultData?.video as Record<string, unknown>)?.url as string | undefined)
      : ((resultData?.image as Record<string, unknown>)?.url as string | undefined);

  if (!url) {
    throw new Error("Upscale returned no result");
  }

  return url;
}
