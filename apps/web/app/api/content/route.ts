import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { editHandler } from "@/lib/content/edit/editHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * PATCH /api/content
 *
 * Edits a media asset by triggering the `ffmpeg-edit` Trigger.dev task with explicit
 * operations or a template preset. Returns immediately with a run id; the actual
 * edit happens asynchronously. Body is validated by `validateEditContentBody` in
 * `lib/content/edit/`.
 *
 * @param request - The incoming request with JSON body `{ url, operations? | template? }`
 *   (see `validateEditContentBody` for the full schema). Exactly one of `operations`
 *   or `template` must be provided.
 * @returns A 202 NextResponse with `{ runId, status: "triggered" }` when the task is
 *   queued, 400 on a bad body, or 500 when the task cannot be triggered.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return editHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
