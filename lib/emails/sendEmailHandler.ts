import { NextRequest, NextResponse } from "next/server";
import { validateSendEmailBody } from "@/lib/emails/validateSendEmailBody";
import { deliverEmail } from "@/lib/emails/deliverEmail";
import { logEmailAttempt } from "@/lib/emails/logEmailAttempt";

/**
 * Handler for POST /api/emails. Auth + body validation + the recipient
 * restriction live in `validateSendEmailBody` (which also returns the raw body);
 * the actual Resend send + response shaping live in `deliverEmail`.
 *
 * Every attempt — sent, send_failed, rejected — is recorded in `email_send_log`
 * with a single `logEmailAttempt` call, so a send is debuggable days later
 * without the ephemeral sandbox.
 */
export async function sendEmailHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateSendEmailBody(request);

  const { response, attempt } =
    "data" in validated
      ? await deliverEmail(validated.data)
      : { response: validated.error, attempt: { status: "rejected" as const } };

  await logEmailAttempt({ rawBody: validated.rawBody, ...attempt });
  return response;
}
