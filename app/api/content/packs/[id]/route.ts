import { NextRequest } from "next/server";
import { handlePackRequest } from "@/lib/content/packs/handlePackRequest";
type Context = { params: Promise<{ id: string }> };
/**
 * Read private pack progress and refreshed download links.
 *
 * @param request - Authenticated HTTP request.
 * @param context - Dynamic route context.
 * @returns Private pack state or a controlled error response.
 */
export async function GET(request: NextRequest, context: Context) {
  return handlePackRequest(request, "get", (await context.params).id);
}
/**
 * Revise an unproduced pack using its current revision.
 *
 * @param request - Authenticated HTTP request.
 * @param context - Dynamic route context.
 * @returns Private pack state or a controlled error response.
 */
export async function PATCH(request: NextRequest, context: Context) {
  return handlePackRequest(request, "prepare", (await context.params).id);
}
