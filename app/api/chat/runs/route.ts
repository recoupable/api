import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { handleStartChatRun } from "@/lib/chat/runs/handleStartChatRun";

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
 * POST /api/chat/runs
 *
 * Start an asynchronous, headless chat-generation run on the durable
 * `runAgentWorkflow` (recoupable/chat#1813). Provisions a session + sandbox,
 * starts a workflow run, and returns `{ runId, chatId, sessionId }` with **202**
 * immediately (plus a `Location` header at the run-status resource) — generation,
 * assistant-message persistence, and side effects happen server-side after the
 * response.
 *
 * Authentication: x-api-key header required (account inferred from the key;
 * org keys may override via body `accountId`).
 *
 * Request body:
 * - prompt: String prompt (mutually exclusive with messages)
 * - messages: Array of UIMessages (mutually exclusive with prompt)
 * - artistId: Optional UUID of the artist account
 * - model: Optional model ID override (default anthropic/claude-haiku-4.5)
 * - topic: Optional session title
 * - accountId: Optional accountId override (requires org API key)
 *
 * Response body (202): `{ runId, chatId, sessionId }`. Read the result later via
 * `GET /api/chat/{chatId}/stream` (watch the stream) or the chat's persisted
 * messages; poll `GET /api/chat/runs/{runId}` for status (status route lands in
 * a follow-up).
 *
 * @param request - The request object
 * @returns 202 `{ runId, chatId, sessionId }`, or a 4xx/5xx error
 */
export async function POST(request: NextRequest): Promise<Response> {
  return handleStartChatRun(request);
}

// Provisioning (repo + session + sandbox) runs before the 202 returns, so give
// the function headroom beyond the default. The workflow itself runs durably
// outside this request.
export const maxDuration = 120;
export const dynamic = "force-dynamic";
