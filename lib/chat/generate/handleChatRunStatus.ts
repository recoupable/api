import { NextRequest, NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { normalizeRunStatus } from "@/lib/chat/generate/normalizeRunStatus";

/**
 * Handles `GET /api/chat/runs/{runId}` — a point-in-time status snapshot for an
 * asynchronous run started via `POST /api/chat/runs` (recoupable/chat#1813).
 * Wraps the durable workflow's `getRun(runId).status`; returns `{ runId, status }`.
 * Not the generated content — read that via the chat (`chatId` from the 202 start
 * response): `GET /api/chat/{chatId}/stream` or the persisted messages.
 *
 * @param request - The incoming request (x-api-key auth).
 * @param runId - The durable workflow run id from the path.
 * @returns 200 `{ runId, status }`, 401/403 on auth, or 404 if the run is unknown.
 */
export async function handleChatRunStatus(request: NextRequest, runId: string): Promise<Response> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) return auth;

  let rawStatus: string;
  try {
    rawStatus = await getRun(runId).status;
  } catch (error) {
    console.error(`[handleChatRunStatus] run not found ${runId}:`, error);
    return errorResponse("Run not found", 404);
  }

  return NextResponse.json(
    { runId, status: normalizeRunStatus(rawStatus) },
    { status: 200, headers: getCorsHeaders() },
  );
}
