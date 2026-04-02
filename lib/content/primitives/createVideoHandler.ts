import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validatePrimitiveBody } from "./validatePrimitiveBody";
import { createVideoBodySchema } from "./schemas";

const DEFAULT_I2V_MODEL = "fal-ai/veo3.1/fast/image-to-video";
const DEFAULT_A2V_MODEL = "fal-ai/ltx-2-19b/audio-to-video";

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
    let videoUrl: string | undefined;
    const input: Record<string, unknown> = {};

    if (validated.prompt) input.prompt = validated.prompt;
    if (validated.image_url) input.image_url = validated.image_url;
    if (validated.motion_prompt) input.prompt = validated.motion_prompt;

    if (validated.lipsync && validated.audio_url) {
      input.audio_url = validated.audio_url;
      if (!input.prompt) input.prompt = "person staring at camera, subtle movement";
      const model = validated.model ?? DEFAULT_A2V_MODEL;
      const result = await fal.subscribe(model, { input });
      const resultData = result.data as Record<string, unknown>;
      videoUrl = (resultData?.video as Record<string, unknown>)?.url as string | undefined;
    } else {
      if (!input.prompt) input.prompt = "nearly still, only natural breathing";
      const model = validated.model ?? DEFAULT_I2V_MODEL;
      const result = await fal.subscribe(model, { input });
      const resultData = result.data as Record<string, unknown>;
      videoUrl = (resultData?.video as Record<string, unknown>)?.url as string | undefined;
    }

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
