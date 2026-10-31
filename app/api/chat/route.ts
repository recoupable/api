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
 * POST /api/chat
 *
 * Canonical path for the sandbox-driven agent loop (Vercel Workflow).
 * New turns are admitted only when no workflow owns the chat slot.
 * Reconnection uses GET /api/chat/{chatId}/stream. The exact
 * streamLifecycle=explicit-stop-v1 query opts into explicit server Stop.
 *
 * Contract: https://docs.recoupable.dev/api-reference/chat/workflow
 *
 * @param request - The incoming NextRequest.
 * @returns A streaming Response (200) or a NextResponse error.
 */
export async function POST(request: NextRequest): Promise<Response> {
  return handleChatWorkflowStream(request);
}
