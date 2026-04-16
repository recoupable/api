import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";

export type ValidatedGetResearchTrackRequest = {
  accountId: string;
  id: string;
};

/**
 * Validates `GET /api/research/track` — auth + required numeric `id` (the
 * Chartmetric track ID). Discovery (search by name, filter by artist) is the
 * caller's job via `GET /api/research?type=tracks&beta=true`; this endpoint
 * is a thin detail-lookup proxy.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchTrackRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchTrackRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return errorResponse("id parameter is required", 400);
  if (!/^[1-9]\d*$/.test(id)) return errorResponse("id must be a positive integer", 400);

  return { accountId: authResult.accountId, id };
}
