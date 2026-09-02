import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateVideoBody } from "./validateCreateVideoBody";
import { generateVideo } from "./generateVideo";
import { inferMode } from "./inferMode";
import { ensureVideoCredits } from "@/lib/content/ensureContentCredits";
import { parseDurationSeconds } from "@/lib/content/parseDurationSeconds";

/**
 * POST /api/content/video
 *
 * @param request - Incoming request with video generation parameters.
 * @returns JSON with the generated video URL.
 */
export async function createVideoHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateCreateVideoBody(request);
  if (validated instanceof NextResponse) return validated;

  // Price on the same mode the generator will resolve, so the charge and the
  // model can never disagree.
  const mode = validated.mode ?? inferMode(validated);
  const short = await ensureVideoCredits(
    validated.accountId,
    parseDurationSeconds(validated.duration),
    mode,
  );
  if (short) return short;

  try {
    const result = await generateVideo(validated);
    return NextResponse.json(result, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("Video generation error:", error);
    const message = error instanceof Error ? error.message : "Video generation failed";
    const status = message.includes("no video") ? 502 : 500;
    return NextResponse.json(
      { status: "error", error: message },
      { status, headers: getCorsHeaders() },
    );
  }
}
