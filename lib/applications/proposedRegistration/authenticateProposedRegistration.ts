import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateProposedRegistrationActor } from "./validateProposedRegistrationActor";
/** Unwired server boundary. Never accepts a body actor, override or substituted auth callback. */
export async function authenticateProposedRegistration(request: NextRequest) {
  const auth = await validateAuthContext(request, {
    allowAccountCreation: false,
    includeVerificationEvidence: true,
  });
  if (auth instanceof NextResponse) throw auth;
  return validateProposedRegistrationActor(auth);
}
