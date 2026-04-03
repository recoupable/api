import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validatePrimitiveBody } from "./validatePrimitiveBody";
import { configureFal } from "./configureFal";
import { createVideoBodySchema } from "./schemas";
import { loadTemplate } from "@/lib/content/templates";

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
 * Maps user-facing fields to the fal input format for each mode.
 * Different fal models expect different field names for the same concept.
 *
 * @param mode - The resolved video generation mode.
 * @param v - Validated request body.
 * @returns The fal input object with mode-specific field mappings.
 */
function buildFalInput(
  mode: string,
  v: {
    prompt?: string;
    negative_prompt?: string;
    image_url?: string;
    end_image_url?: string;
    video_url?: string;
    audio_url?: string;
    aspect_ratio: string;
    duration: string;
    resolution: string;
    generate_audio: boolean;
  },
): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: v.prompt ?? "",
    aspect_ratio: v.aspect_ratio,
    duration: v.duration,
    resolution: v.resolution,
    generate_audio: v.generate_audio,
    safety_tolerance: "6",
    auto_fix: true,
  };

  if (v.negative_prompt) input.negative_prompt = v.negative_prompt;

  if (mode === "reference" && v.image_url) {
    input.image_urls = [v.image_url];
  } else if (mode === "first-last" && v.image_url) {
    input.first_frame_url = v.image_url;
    if (v.end_image_url) input.last_frame_url = v.end_image_url;
  } else if (v.image_url) {
    input.image_url = v.image_url;
  }

  if (v.video_url) input.video_url = v.video_url;
  if (v.audio_url) input.audio_url = v.audio_url;

  return input;
}

/**
 * POST /api/content/video
 *
 * @param request - Incoming request with video generation parameters.
 * @returns JSON with the generated video URL.
 */
export async function createVideoHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const validated = await validatePrimitiveBody(request, createVideoBodySchema);
  if (validated instanceof NextResponse) return validated;

  const falError = configureFal();
  if (falError) return falError;

  try {
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
      return NextResponse.json(
        { status: "error", error: "Video generation returned no video" },
        { status: 502, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json({ videoUrl, mode }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("Video generation error:", error);
    return NextResponse.json(
      { status: "error", error: "Video generation failed" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
