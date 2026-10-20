import { NextRequest } from "next/server";
import { handlePackRequest } from "@/lib/content/packs/handlePackRequest";
/**
 * Export the caller-owned release pack using its saved brief and budget.
 *
 * @param request - Authenticated HTTP request.
 * @param context - Dynamic route context.
 * @param context.params - Saved pack identity.
 * @returns Private pack state or a controlled error response.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handlePackRequest(request, "export", (await context.params).id);
}
