import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateInboundEmailEvent } from "@/lib/emails/validateInboundEmailEvent";
import { respondToInboundEmail } from "@/lib/emails/inbound/respondToInboundEmail";

/**
 * Handles inbound email webhook events from Resend.
 * For "email.received" events, sends a hard-coded reply email in the same thread
 * using the Resend API and returns the Resend API response payload.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse object
 */
export async function handleInboundEmail(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  const validatedOrError = validateInboundEmailEvent(body);

  if (validatedOrError instanceof NextResponse) {
    return validatedOrError;
  }

  const event = validatedOrError;

  if (event?.type === "email.received") {
    return respondToInboundEmail(event);
  }

  // For non-email.received events, just acknowledge with an empty payload
  return NextResponse.json({});
}
