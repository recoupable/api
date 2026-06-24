import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { handleChatGenerate } from "@/lib/chat/handleChatGenerate";

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
 * POST /api/chat/generate
 *
 * Asynchronous, headless chat generation on the durable `runAgentWorkflow`
 * (recoupable/chat#1813). Provisions a session + sandbox, starts a workflow run,
 * and returns `{ runId }` with **202** immediately — generation, assistant-
 * message persistence, and side effects happen server-side after the response.
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
 * Response body (202): `{ runId }` — the durable workflow run id.
 *
 * @param request - The request object
 * @returns 202 `{ runId }`, or a 4xx/5xx error
 */
export async function POST(request: NextRequest): Promise<Response> {
  return handleChatGenerate(request);
}

// Provisioning (repo + session + sandbox) runs before the 202 returns, so give
// the function headroom beyond the default. The workflow itself runs durably
// outside this request.
export const maxDuration = 120;
export const dynamic = "force-dynamic";
