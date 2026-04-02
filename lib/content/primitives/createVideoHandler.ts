import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validatePrimitiveBody } from "./validatePrimitiveBody";
import { createVideoBodySchema } from "./schemas";

const MODELS: Record<string, string> = {
  prompt: "fal-ai/veo3.1",
  animate: "fal-ai/veo3.1/image-to-video",
  reference: "fal-ai/veo3.1/reference-to-video",
  extend: "fal-ai/veo3.1/extend-video",
  "first-last": "fal-ai/veo3.1/first-last-frame-to-video",
  lipsync: "fal-ai/ltx-2-19b/audio-to-video",
};

/**
 * Infers the mode from the inputs when the caller doesn't specify one.
 *
 * @param v - Validated request body.
 * @returns The inferred mode string.
 */
function inferMode(v: {
  audio_url?: string;
  video_url?: string;
  image_url?: string;
  end_image_url?: string;
}): string {
  if (v.audio_url && v.image_url) return "lipsync";
  if (v.video_url) return "extend";
  if (v.image_url && v.end_image_url) return "first-last";
  if (v.image_url) return "animate";
  return "prompt";
}

/**
 * POST /api/content/generate-video
 *
 * @param request - Incoming request with video generation parameters.
 * @returns JSON with the generated video URL.
 */
export async function createVideoHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const validated = await validatePrimitiveBody(request, createVideoBodySchema);
  if (validated instanceof NextResponse) return validated;

  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return NextResponse.json(
      { status: "error", error: "FAL_KEY is not configured" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
  fal.config({ credentials: falKey });

  try {
    const mode = validated.mode ?? inferMode(validated);
    const model = validated.model ?? MODELS[mode] ?? MODELS.prompt;

    const input: Record<string, unknown> = {
      aspect_ratio: validated.aspect_ratio,
      duration: validated.duration,
      resolution: validated.resolution,
      generate_audio: validated.generate_audio,
      safety_tolerance: "6",
      auto_fix: true,
    };

    if (validated.prompt) input.prompt = validated.prompt;
    if (validated.negative_prompt) input.negative_prompt = validated.negative_prompt;

    if (mode === "reference" && validated.image_url) {
      input.image_urls = [validated.image_url];
    } else if (mode === "first-last" && validated.image_url) {
      input.first_frame_url = validated.image_url;
      if (validated.end_image_url) input.last_frame_url = validated.end_image_url;
    } else if (validated.image_url) {
      input.image_url = validated.image_url;
    }
    if (validated.video_url) input.video_url = validated.video_url;
    if (validated.audio_url) input.audio_url = validated.audio_url;

    const result = await fal.subscribe(model, { input });
    const resultData = result.data as Record<string, unknown>;
    const videoUrl = (resultData?.video as Record<string, unknown>)?.url as string | undefined;

    if (!videoUrl) {
      return NextResponse.json(
        { status: "error", error: "Video generation returned no video" },
        { status: 502, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      { videoUrl, mode },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Video generation error:", error);
    return NextResponse.json(
      { status: "error", error: "Video generation failed" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
