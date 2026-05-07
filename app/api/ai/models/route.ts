import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAvailableModelsHandler } from "@/lib/ai/getAvailableModelsHandler";

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
 * GET /api/ai/models
 *
 * Server-side endpoint that proxies the Vercel AI Gateway model catalog so
 * the client can fetch model metadata without bundling `@ai-sdk/gateway`.
 * Embed models are filtered out.
 *
 * @returns A NextResponse with `{ models }` on 200, `{ message }` on 500.
 */
export async function GET() {
  return getAvailableModelsHandler();
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
