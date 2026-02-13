import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { renderVideoHandler } from "@/lib/render/renderVideoHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * POST /api/video/render
 *
 * Triggers a server-side video render as a background task. Returns
 * immediately with a Trigger.dev run ID that can be polled via
 * GET /api/tasks/runs?runId=<runId> for status and the rendered video URL.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Request body:
 * - compositionId: string (required) - The composition to render
 * - inputProps: object (optional) - Props to pass to the composition
 * - width: number (optional, default 720)
 * - height: number (optional, default 1280)
 * - fps: number (optional, default 30)
 * - durationInFrames: number (optional, default 240)
 * - codec: "h264" | "h265" | "vp8" | "vp9" (optional, default "h264")
 *
 * Response (200):
 * - status: "processing"
 * - runId: string - The Trigger.dev run ID for the render task
 *
 * Error (400/401/500):
 * - status: "error"
 * - error: string
 *
 * @param request - The request object
 * @returns A NextResponse with the render result or error
 */
export async function POST(request: NextRequest): Promise<Response> {
  return renderVideoHandler(request);
}
