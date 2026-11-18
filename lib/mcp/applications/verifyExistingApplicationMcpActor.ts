import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateProposedRegistrationActor } from "@/lib/applications/proposedRegistration/validateProposedRegistrationActor";
import { verifyOAuthBearer } from "@/lib/oauth/verifyOAuthBearer";

/** Unwired standard-MCP identity observation, never an execution grant or public tool result. */
export async function verifyExistingApplicationMcpActor(request: NextRequest) {
  try {
    const bearer = /^Bearer +([^\s]+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
    if (!bearer || request.headers.has("x-api-key"))
      return NextResponse.json(
        { error: "Standard Bearer authentication required" },
        { status: 401 },
      );
    // Classification failure must not become a legacy fallback in this opt-in boundary.
    if (await verifyOAuthBearer(bearer))
      return NextResponse.json(
        { error: "Delegated authentication is unsupported" },
        { status: 403 },
      );
    const auth = await validateAuthContext(request, {
      allowAccountCreation: false,
      includeVerificationEvidence: true,
    });
    if (auth instanceof NextResponse) return auth;
    const actor = validateProposedRegistrationActor(auth);
    return { ...actor, verificationEvidence: structuredClone(auth.verificationEvidence!) };
  } catch {
    return NextResponse.json(
      { error: "Verified application identity unavailable" },
      { status: 503 },
    );
  }
}
