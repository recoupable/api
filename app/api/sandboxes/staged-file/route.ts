import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postSandboxesUploadTokensHandler } from "@/lib/sandbox/postSandboxesUploadTokensHandler";

/**
 * CORS preflight.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * POST /api/sandboxes/staged-file — Vercel Blob client-upload token handshake.
 *
 * @param request - The request object.
 * @returns A NextResponse with the handshake result or error.
 */
export async function POST(request: NextRequest): Promise<Response> {
  return postSandboxesUploadTokensHandler(request);
}
