import { type NextRequest, NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/internal/validateCronRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { runColdStartNudgeSweep } from "@/lib/onboarding/runColdStartNudgeSweep";

/**
 * GET /api/internal/cold-start-nudge — daily Vercel Cron entrypoint that nudges
 * welcomed accounts which never added an artist (chat#1889). Cron-only
 * (CRON_SECRET bearer); an empty window is a no-op.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response describing what the sweep did.
 */
export async function coldStartNudgeHandler(
  request: NextRequest,
): Promise<NextResponse> {
  const denied = validateCronRequest(request);
  if (denied) return denied;

  try {
    const result = await runColdStartNudgeSweep();

    return NextResponse.json(
      { status: "success", ...result },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Error running cold-start nudge sweep:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
