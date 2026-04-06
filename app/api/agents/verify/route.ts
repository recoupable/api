import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import {
  validateAgentVerifyBody,
  type AgentVerifyBody,
} from "@/lib/agents/validateAgentVerifyBody";
import { agentVerifyHandler } from "@/lib/agents/agentVerifyHandler";

/**
 * POST /api/agents/verify
 *
 * Verify an agent's email with the code sent during signup.
 * Returns an API key on success. This endpoint is unauthenticated.
 *
 * @param req - The incoming request with email and code in body
 * @returns Verify response with account_id, api_key, and message
 */
export async function POST(req: NextRequest) {
  const body = await safeParseJson(req);

  const validated = validateAgentVerifyBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }

  return agentVerifyHandler(validated as AgentVerifyBody);
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
