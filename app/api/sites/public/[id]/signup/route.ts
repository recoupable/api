import { NextResponse } from "next/server";
import { processPublicSite } from "@/lib/sites/processPublicSite";
import { siteResponseError } from "@/lib/sites/siteResponseError";
/**
 * Record explicit fan email consent on a currently published site.
 *
 * @param request - Request or route context.
 * @param root0 - Request or route context.
 * @param root0.params - Request or route context.
 * @returns HTTP response.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(
      await processPublicSite((await params).id, await request.json().catch(() => null)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return siteResponseError(error);
  }
}
