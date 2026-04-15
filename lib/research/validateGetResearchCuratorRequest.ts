import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";

export type ValidatedGetResearchCuratorRequest = {
  accountId: string;
  platform: string;
  id: string;
};

/**
 * Validates `GET /api/research/curator` — auth + required `platform` and `id`
 * query params.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchCuratorRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchCuratorRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  const id = searchParams.get("id");

  if (!platform || !id) {
    return errorResponse("platform and id parameters are required", 400);
  }

  return { accountId: authResult.accountId, platform, id };
}
