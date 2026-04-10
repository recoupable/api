import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectPredictions } from "@/lib/supabase/predictions/selectPredictions";

/**
 * Handler for GET /api/predictions.
 * Returns past predictions for the authenticated account.
 *
 * @param request - The incoming request with optional limit/offset query params.
 * @returns A NextResponse with the predictions array or an error.
 */
export async function getListPredictionsHandler(
  request: NextRequest,
): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { accountId } = authResult;

  const url = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 1), 100);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);

  try {
    const predictions = await selectPredictions(accountId, limit, offset);
    return NextResponse.json(
      { status: "success", predictions },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch predictions";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
