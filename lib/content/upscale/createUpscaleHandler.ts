import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validatePrimitiveBody } from "@/lib/content/validatePrimitiveBody";
import { configureFal } from "@/lib/fal/server";
import { createUpscaleBodySchema } from "@/lib/content/schemas";

/**
 * POST /api/content/upscale
 *
 * @param request - Incoming request with the URL and type to upscale.
 * @returns JSON with the upscaled URL.
 */
export async function createUpscaleHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const validated = await validatePrimitiveBody(request, createUpscaleBodySchema);
  if (validated instanceof NextResponse) return validated;

  const falError = configureFal();
  if (falError) return falError;

  try {
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
