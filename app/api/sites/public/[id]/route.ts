import { NextResponse } from "next/server";
import { processPublicSite } from "@/lib/sites/processPublicSite";
import { siteResponseError } from "@/lib/sites/siteResponseError";
export const dynamic = "force-dynamic";
/**
 * Read a published snapshot without exposing the private draft.
 *
 * @param _request - Request or route context.
 * @param root0 - Request or route context.
 * @param root0.params - Request or route context.
 * @returns HTTP response.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(await processPublicSite((await params).id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return siteResponseError(error);
  }
}
