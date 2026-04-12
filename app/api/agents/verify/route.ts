import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { agentVerifyHandler } from "@/lib/agents/agentVerifyHandler";

/**
 * POST /api/agents/verify
 *
 * Verify an agent's email with the code sent during signup.
 * Returns an API key on success. This endpoint is unauthenticated.
 *
 * @param req - The incoming request with `{ email, code }` in the body
 * @returns Verify response with `account_id`, `api_key`, and `message`
 */
export async function POST(req: NextRequest) {
  return agentVerifyHandler(req);
}

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns NextResponse with CORS headers
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
