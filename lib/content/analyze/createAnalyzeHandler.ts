import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { analyzeVideo } from "@/lib/twelvelabs/analyzeVideo";
import { validateAnalyzeVideoBody } from "./validateAnalyzeVideoBody";

/**
 * POST /api/content/analyze
 *
 * @param request - Incoming request with video URL and analysis prompt.
 * @returns JSON with the generated analysis text.
 */
export async function createAnalyzeHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateAnalyzeVideoBody(request);
  if (validated instanceof NextResponse) return validated;

  try {
    const result = await analyzeVideo(validated);

    return NextResponse.json(
      {
        text: result.text,
        finish_reason: result.finishReason,
        usage: result.usage,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Video analysis error:", error);
    const message = error instanceof Error ? error.message : "Video analysis failed";
    const status = message.includes("not configured") ? 500 : 502;
    return NextResponse.json(
      { status: "error", error: message },
      { status, headers: getCorsHeaders() },
    );
  }
}
