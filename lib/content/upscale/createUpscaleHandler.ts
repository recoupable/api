import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateUpscaleBody } from "./validateUpscaleBody";
import { upscaleMedia } from "./upscaleMedia";

/**
 * POST /api/content/upscale
 *
 * @param request - Incoming request with the URL and type to upscale.
 * @returns JSON with the upscaled URL.
 */
export async function createUpscaleHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateUpscaleBody(request);
  if (validated instanceof NextResponse) return validated;

  try {
    const url = await upscaleMedia(validated);
    return NextResponse.json({ url }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("Upscale error:", error);
    const message = error instanceof Error ? error.message : "Upscale failed";
    const status = message.includes("no result") ? 502 : 500;
    return NextResponse.json(
      { status: "error", error: message },
      { status, headers: getCorsHeaders() },
    );
  }
}
