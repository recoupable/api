import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createSandboxHandler } from "@/lib/sandbox/createSandboxHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

/**
 * `POST /api/sandbox` — provision (or resume) a Sandbox bound to a session.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with `{ createdAt, timeout, currentBranch, mode, timing }` on 200, or an error.
 */
export async function POST(request: NextRequest) {
  return createSandboxHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
