import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validatePrimitiveBody } from "@/lib/content/validatePrimitiveBody";
import { createAnalyzeBodySchema } from "@/lib/content/schemas";
import { analyzeVideo } from "@/lib/twelvelabs/analyzeVideo";

/**
 * POST /api/content/analyze
 *
 * @param request - Incoming request with video URL and analysis prompt.
 * @returns JSON with the generated analysis text.
 */
export async function createAnalyzeHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const validated = await validatePrimitiveBody(request, createAnalyzeBodySchema);
  if (validated instanceof NextResponse) return validated;

  try {
    const result = await analyzeVideo({
      videoUrl: validated.video_url,
      prompt: validated.prompt,
      temperature: validated.temperature,
      maxTokens: validated.max_tokens,
    });

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
