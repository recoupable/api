import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Creates the standard route exports for a content primitive endpoint.
 * Provides CORS OPTIONS, the POST handler, and Next.js dynamic config.
 */
export function createPrimitiveRoute(handler: (req: NextRequest) => Promise<NextResponse>) {
  const OPTIONS = () => new NextResponse(null, { status: 204, headers: getCorsHeaders() });
  const POST = (request: NextRequest) => handler(request);

  return { OPTIONS, POST };
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
