import { errorResponse } from "@/lib/networking/errorResponse";
import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateApplicationRegistration } from "./validateApplicationRegistration";
import { registrationErrorResponse } from "./registrationErrorResponse";
/** Authenticated preflight for application registration; no resource is created. */
export async function validateApplicationRegistrationHandler(request: NextRequest) {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) return auth;
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  try {
    const result = await validateApplicationRegistration(
      auth.accountId,
      await request.json().catch(() => null),
    );
    return NextResponse.json(result, { headers });
  } catch (error) {
    const failure = registrationErrorResponse(error);
    const response = errorResponse(failure.error, failure.status);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
