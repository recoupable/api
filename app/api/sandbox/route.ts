import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createSandboxPostHandler } from "@/lib/sandbox/createSandboxPostHandler";

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
 * POST /api/sandbox
 *
 * Executes a script in a Vercel Sandbox with Claude's Agent SDK pre-installed.
 * Sandboxes are isolated Linux microVMs that can be used to evaluate
 * AI agent output safely or execute reproducible tasks with the Anthropic SDK.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Request body:
 * - script: The JavaScript/TypeScript script to execute (required)
 *
 * Response body:
 * - status: 'success' or 'error'
 * - data: {
 *     sandboxId: string,
 *     output: string,
 *     exitCode: number
 *   }
 *
 * @param request - The request object
 * @returns A NextResponse with the sandbox execution result or error
 */
export async function POST(request: NextRequest): Promise<Response> {
  return createSandboxPostHandler(request);
}
