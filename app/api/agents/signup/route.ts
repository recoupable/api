import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { agentSignupHandler } from "@/lib/agents/agentSignupHandler";

/**
 * POST /api/agents/signup
 *
 * Register an agent. For new agent+ emails, returns an API key immediately.
 * For all other cases, sends a verification code to the email.
 * This endpoint is unauthenticated.
 *
 * @param req - The incoming request with `{ email }` in the body
 * @returns Signup response with `account_id`, `api_key` (or null), and `message`
 */
export async function POST(req: NextRequest) {
  return agentSignupHandler(req);
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
