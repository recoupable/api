import { NextRequest, NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { normalizeRunStatus } from "@/lib/chat/runs/normalizeRunStatus";

/**
 * Handles `GET /api/chat/runs/{runId}` — a point-in-time status snapshot for an
 * asynchronous run started via `POST /api/chat/runs` (recoupable/chat#1813).
 * Wraps the durable workflow's `getRun(runId)`; returns `{ runId, status,
 * createdAt, startedAt, completedAt, durationMs }` (timing per chat#2006).
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

  // `status` alone decides whether the run exists (404). Timing comes from
  // the same run (chat#2006 item 4a) but is best-effort: a getter that
  // rejects yields null for that field rather than turning a live run into
  // a 404.
  let run: ReturnType<typeof getRun>;
  let rawStatus: string;
  try {
    run = getRun(runId);
    rawStatus = await run.status;
  } catch (error) {
    console.error(`[handleChatRunStatus] run not found ${runId}:`, error);
    return errorResponse("Run not found", 404);
  }
  const [createdAt, startedAt, completedAt] = (
    await Promise.allSettled([run.createdAt, run.startedAt, run.completedAt])
  ).map(result => (result.status === "fulfilled" ? result.value : undefined));

  const durationMs = startedAt && completedAt ? completedAt.getTime() - startedAt.getTime() : null;

  return NextResponse.json(
    {
      runId,
      status: normalizeRunStatus(rawStatus),
      createdAt: createdAt?.toISOString() ?? null,
      startedAt: startedAt?.toISOString() ?? null,
      completedAt: completedAt?.toISOString() ?? null,
      durationMs,
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
