import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { dispatchDevelopmentEntitlement } from "./dispatchDevelopmentEntitlement";
/** POST /api/context/development/entitlements: disabled outside explicitly enabled local development. */
export async function developmentEntitlementHandler(request: NextRequest) {
  const result = await dispatchDevelopmentEntitlement(
    () => request.json(),
    async () => {
      const auth = await validateAuthContext(request);
      return auth instanceof NextResponse
        ? { denied: "authentication_required" as const }
        : { accountId: auth.accountId };
    },
  );
  const response =
    "error" in result.body
      ? errorResponse(result.body.error, result.status, { code: result.body.code })
      : NextResponse.json(result.body, { status: result.status, headers: getCorsHeaders() });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
