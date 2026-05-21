import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { handleChatWorkflowStream } from "@/lib/chat/handleChatWorkflowStream";

export const maxDuration = 800;

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
 * POST /api/chat/workflow
 *
 * Streams a sandbox-driven agent loop (Vercel Workflow) for an existing
 * session + chat. Currently returns a hardcoded UIMessage stream stub —
 * the workflow is wired up in a follow-up PR.
 *
 * Contract: https://developers.recoupable.com/api-reference/chat/workflow
 *
 * @param request - The incoming NextRequest.
 * @returns A streaming Response (200) or a NextResponse error.
 */
export async function POST(request: NextRequest): Promise<Response> {
  return handleChatWorkflowStream(request);
}
