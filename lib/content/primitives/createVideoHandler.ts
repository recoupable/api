import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validatePrimitiveBody } from "./validatePrimitiveBody";
import { createVideoBodySchema } from "./schemas";

const DEFAULT_T2V_MODEL = "fal-ai/veo3.1/text-to-video";
const DEFAULT_I2V_MODEL = "fal-ai/veo3.1/image-to-video";
const DEFAULT_A2V_MODEL = "fal-ai/ltx-2-19b/audio-to-video";

/**
 * Picks the right model based on what inputs the caller provided.
 *
 * @param hasImage - Whether an image URL was provided.
 * @param hasLipsync - Whether lipsync mode with audio was requested.
 * @returns The default fal model ID.
 */
function resolveDefaultModel(hasImage: boolean, hasLipsync: boolean): string {
  if (hasLipsync) return DEFAULT_A2V_MODEL;
  if (hasImage) return DEFAULT_I2V_MODEL;
  return DEFAULT_T2V_MODEL;
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
    const hasLipsync = !!(validated.lipsync && validated.audio_url);
    const hasImage = !!validated.image_url;
    const model = validated.model ?? resolveDefaultModel(hasImage, hasLipsync);

    const input: Record<string, unknown> = {};
    if (validated.prompt) input.prompt = validated.prompt;
    if (validated.motion_prompt) input.prompt = validated.motion_prompt;
    if (validated.image_url) input.image_url = validated.image_url;
    if (hasLipsync) input.audio_url = validated.audio_url;

    const result = await fal.subscribe(model, { input });
    const resultData = result.data as Record<string, unknown>;
    const videoUrl = (resultData?.video as Record<string, unknown>)?.url as string | undefined;

    if (!videoUrl) {
      return NextResponse.json(
        { status: "error", error: "Video generation returned no video" },
        { status: 502, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json({ videoUrl }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("Video generation error:", error);
    return NextResponse.json(
      { status: "error", error: "Video generation failed" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
