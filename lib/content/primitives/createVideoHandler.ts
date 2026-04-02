import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validatePrimitiveBody } from "./validatePrimitiveBody";
import { createVideoBodySchema } from "./schemas";

/**
 * POST /api/content/create/video
 * Generates a video from an image using fal.ai inline.
 *
 * @param request - Incoming request with video generation parameters.
 * @returns JSON with the generated video URL.
 */
export async function createVideoHandler(request: NextRequest): Promise<NextResponse> {
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
    const { data } = validated;
    let videoUrl: string | undefined;

    if (data.lipsync && data.song_url) {
      const result = await fal.subscribe("fal-ai/ltx-2-19b/audio-to-video" as string, {
        input: {
          image_url: data.image_url,
          audio_url: data.song_url,
          prompt: data.motion_prompt ?? "person staring at camera, subtle movement",
        },
      });
      const resultData = result.data as Record<string, unknown>;
      videoUrl = (resultData?.video as Record<string, unknown>)?.url as string | undefined;
    } else {
      const result = await fal.subscribe("fal-ai/veo3.1/fast/image-to-video" as string, {
        input: {
          image_url: data.image_url,
          prompt: data.motion_prompt ?? "nearly still, only natural breathing",
        },
      });
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
