import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validatePrimitiveBody } from "./validatePrimitiveBody";
import { createUpscaleBodySchema } from "./schemas";

/**
 * POST /api/content/create/upscale
 * Upscales an image or video using fal.ai inline.
 *
 * @param request - Incoming request with the URL and type to upscale.
 * @returns JSON with the upscaled URL.
 */
export async function createUpscaleHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validatePrimitiveBody(request, createUpscaleBodySchema);
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
    const model =
      data.type === "video" ? "fal-ai/seedvr/upscale/video" : "fal-ai/seedvr/upscale/image";

    const inputKey = data.type === "video" ? "video_url" : "image_url";

    const result = await fal.subscribe(model as string, {
      input: { [inputKey]: data.url },
    });

    const resultData = result.data as Record<string, unknown>;
    const url =
      data.type === "video"
        ? ((resultData?.video as Record<string, unknown>)?.url as string | undefined)
        : ((resultData?.image as Record<string, unknown>)?.url as string | undefined);

    if (!url) {
      return NextResponse.json(
        { status: "error", error: "Upscale returned no result" },
        { status: 502, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json({ url }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("Upscale error:", error);
    return NextResponse.json(
      { status: "error", error: "Upscale failed" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
