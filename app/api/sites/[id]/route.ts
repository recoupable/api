import { NextRequest, NextResponse } from "next/server";
import { actionSchema } from "@/lib/sites/schema";
import { siteOperationHandler } from "@/lib/sites/siteOperationHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
export const maxDuration = 300;
type Context = { params: Promise<{ id: string }> };
/**
 * Read the authenticated site's current version.
 *
 * @param request - Request or route context.
 * @param context - Request or route context.
 * @returns HTTP response.
 */
export async function GET(request: NextRequest, context: Context) {
  return siteOperationHandler(request, "get", await context.params);
}
/**
 * Generate, publish or unpublish using an expected revision.
 *
 * @param request - Request or route context.
 * @param context - Request or route context.
 * @returns HTTP response.
 */
export async function PATCH(request: NextRequest, context: Context) {
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid site action" },
      { status: 400, headers: getCorsHeaders() },
    );
  const { action, ...input } = parsed.data;
  return siteOperationHandler(request, action, { ...input, ...(await context.params) });
}
/**
 * Browser preflight.
 *
 * @returns HTTP response.
 */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
