import { getEvidenceManifestHandler } from "@/lib/context/getEvidenceManifestHandler";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/** Read retained evidence metadata without collection or mutation. */
export const GET = getEvidenceManifestHandler;

/**
 * Permit authenticated browser clients to preflight the read endpoint.
 *
 * @returns Empty CORS preflight response.
 */
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}
