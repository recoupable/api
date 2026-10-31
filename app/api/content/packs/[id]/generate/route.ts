import { NextRequest } from "next/server";
import { handlePackRequest } from "@/lib/content/packs/handlePackRequest";
/**
 * Generate the caller-owned release pack using its saved brief and budget.
 *
 * @param request - Authenticated HTTP request.
 * @param context - Dynamic route context.
 * @param context.params - Saved pack identity.
 * @returns Private pack state or a controlled error response.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handlePackRequest(request, "generate", (await context.params).id);
}
