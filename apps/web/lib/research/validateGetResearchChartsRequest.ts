import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";

const VALID_TYPES = ["regional", "viral"] as const;
const VALID_INTERVALS = ["daily", "weekly"] as const;
const VALID_LATEST = ["true", "false"] as const;

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
 * ("regional"), and `latest` ("true"). `interval`, `type`, and `latest` are
 * rejected at this layer if they aren't in the documented enum — this turns
 * an opaque upstream Chartmetric 400 into a specific 400 from us.
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

  const type = searchParams.get("type") || "regional";
  if (!(VALID_TYPES as readonly string[]).includes(type)) {
    return errorResponse(`type must be one of: ${VALID_TYPES.join(", ")}`, 400);
  }

  const interval = searchParams.get("interval") || "daily";
  if (!(VALID_INTERVALS as readonly string[]).includes(interval)) {
    return errorResponse(`interval must be one of: ${VALID_INTERVALS.join(", ")}`, 400);
  }

  const latest = searchParams.get("latest") ?? "true";
  if (!(VALID_LATEST as readonly string[]).includes(latest)) {
    return errorResponse(`latest must be "true" or "false"`, 400);
  }

  return {
    accountId: authResult.accountId,
    platform,
    country: searchParams.get("country") || "US",
    interval,
    type,
    latest,
  };
}
