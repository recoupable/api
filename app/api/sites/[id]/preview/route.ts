import { NextRequest } from "next/server";
import { siteOperationHandler } from "@/lib/sites/siteOperationHandler";
/**
 * Owner-only preview capability and audio; no published snapshot is required.
 *
 * @param request - Authenticated request.
 * @param root0 - Route context.
 * @param root0.params - Site identifier.
 * @returns Private preview permission and recording URL.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return siteOperationHandler(request, "preview", await params);
}
