import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";

export type ValidatedGetResearchChartsRequest = {
  accountId: string;
  platform: string;
  country: string;
  interval: string;
  type: string;
  latest: string;
};

/**
 * Validates `GET /api/research/charts` — auth + `platform` (required, lowercase
 * alpha) + defaults for `country` ("US"), `interval` ("daily"), `type`
 * ("regional"), and `latest` ("true").
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchChartsRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchChartsRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  if (!platform) return errorResponse("platform parameter is required", 400);
  if (!/^[a-z]+$/.test(platform)) return errorResponse("Invalid platform parameter", 400);

  return {
    accountId: authResult.accountId,
    platform,
    country: searchParams.get("country") || "US",
    interval: searchParams.get("interval") || "daily",
    type: searchParams.get("type") || "regional",
    latest: searchParams.get("latest") ?? "true",
  };
}
