import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validatePrimitiveBody } from "./validatePrimitiveBody";
import { createAnalyzeBodySchema } from "./schemas";

const TWELVELABS_ANALYZE_URL = "https://api.twelvelabs.io/v1.3/analyze";

/**
 * POST /api/content/create/analyze
 *
 * @param request - Incoming request with video URL and analysis prompt.
 * @returns JSON with the generated analysis text.
 */
export async function createAnalyzeHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const validated = await validatePrimitiveBody(request, createAnalyzeBodySchema);
  if (validated instanceof NextResponse) return validated;

  const apiKey = process.env.TWELVELABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { status: "error", error: "TWELVELABS_API_KEY is not configured" },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  try {
    const response = await fetch(TWELVELABS_ANALYZE_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        video: { type: "url", url: validated.video_url },
        prompt: validated.prompt,
        temperature: validated.temperature,
        stream: false,
        ...(validated.max_tokens && { max_tokens: validated.max_tokens }),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Twelve Labs analyze error:", response.status, errorBody);
      return NextResponse.json(
        { status: "error", error: `Video analysis failed: ${response.status}` },
        { status: 502, headers: getCorsHeaders() },
      );
    }

    const json = (await response.json()) as {
      data?: string;
      finish_reason?: string;
      usage?: { output_tokens?: number };
    };

    if (!json.data) {
      return NextResponse.json(
        { status: "error", error: "Video analysis returned no text" },
        { status: 502, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      {
        text: json.data,
        finish_reason: json.finish_reason ?? null,
        usage: json.usage ?? null,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Video analysis error:", error);
    return NextResponse.json(
      { status: "error", error: "Video analysis failed" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
