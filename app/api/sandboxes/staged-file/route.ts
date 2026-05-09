import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postSandboxesUploadTokensHandler } from "@/lib/sandbox/postSandboxesUploadTokensHandler";

/** CORS preflight. */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/** POST /api/sandboxes/staged-file — Vercel Blob client-upload token handshake. */
export async function POST(request: NextRequest): Promise<Response> {
  return postSandboxesUploadTokensHandler(request);
}
