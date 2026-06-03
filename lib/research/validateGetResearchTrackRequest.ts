import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureResearchCredits } from "@/lib/research/ensureResearchCredits";
import { errorResponse } from "@/lib/networking/errorResponse";

export type ValidatedGetResearchTrackRequest = {
  accountId: string;
  id: string;
};

const PROVIDER_ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

/**
 * Validates `GET /api/research/track` — auth + required provider track `id`.
 * Discovery (search by name, filter by artist) is the caller's job via
 * `GET /api/research?type=tracks`; this endpoint is a thin detail lookup.
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
  if (!PROVIDER_ID_REGEX.test(id)) return errorResponse("id must be a provider track ID", 400);

  const short = await ensureResearchCredits(authResult.accountId);
  if (short) return short;

  return { accountId: authResult.accountId, id };
}
