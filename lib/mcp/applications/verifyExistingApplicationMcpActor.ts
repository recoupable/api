import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateProposedRegistrationActor } from "@/lib/applications/proposedRegistration/validateProposedRegistrationActor";
import { errorResponse } from "@/lib/networking/errorResponse";
import { verifyOAuthBearer } from "@/lib/oauth/verifyOAuthBearer";

/** Unwired standard-MCP identity observation, never an execution grant or public tool result. */
export async function verifyExistingApplicationMcpActor(request: NextRequest) {
  try {
    const bearer = /^Bearer +([^\s]+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
    if (!bearer || request.headers.has("x-api-key"))
      return errorResponse("Standard Bearer authentication required", 401);
    // Classification failure must not become a legacy fallback in this opt-in boundary.
    if (await verifyOAuthBearer(bearer))
      return errorResponse("Delegated authentication is unsupported", 403);
    const auth = await validateAuthContext(request, {
      allowAccountCreation: false,
      includeVerificationEvidence: true,
    });
    if (auth instanceof NextResponse) return auth;
    const actor = validateProposedRegistrationActor(auth);
    return { ...actor, verificationEvidence: structuredClone(auth.verificationEvidence!) };
  } catch {
    // Provider/guard exceptions may contain credentials; never log raw failures here.
    return errorResponse("Verified application identity unavailable", 503);
  }
}
