import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateSendEmailBody } from "@/lib/emails/validateSendEmailBody";
import { processAndSendEmail } from "@/lib/emails/processAndSendEmail";
import { notifyEmailSent } from "@/lib/emails/notifyEmailSent";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";
import { CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL } from "@/lib/credits/const";

/**
 * Credits charged per email sent. 1 credit = $0.01. Resend's per-email cost is
 * ≤ $0.0004 (cheapest paid tier: Pro $20 / 50,000 emails), which rounds up to
 * the $0.01 minimum — so we charge 1 credit, no markup.
 */
export const EMAIL_CREDIT_COST = 1;

/**
 * Stamped onto the `usage_events.model_id` for each send so endpoint usage is
 * queryable: `select count(*) from usage_events where model_id = 'POST /api/emails'`.
 */
export const EMAIL_USAGE_MODEL_ID = "POST /api/emails";

/**
 * Handler for POST /api/emails.
 *
 * Sends an email to the explicit recipients in the request body via Resend
 * (from `Agent by Recoup <agent@recoupable.com>`), reusing the same
 * `processAndSendEmail` domain function as the `send_email` MCP tool.
 * Account-scoped: requires authentication via x-api-key or Authorization Bearer.
 * Body validation, auth, and the recipient restriction all live in
 * `validateSendEmailBody`.
 *
 * Charges `EMAIL_CREDIT_COST` credits: gate first (402 if the account can't
 * cover it; auto-recharges via a card on file), then deduct only on a
 * successful send (atomic `credits_usage` + `usage_events` via
 * `recordCreditDeduction`).
 *
 * @param request - The request object.
 * @returns A NextResponse with the send result.
 */
export async function sendEmailHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateSendEmailBody(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { to, cc = [], subject, text, html = "", headers = {}, chat_id, accountId } = validated;

    const short = await ensureCreditsOrShortCircuit({
      accountId,
      creditsToDeduct: EMAIL_CREDIT_COST,
      successUrl: CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL,
    });
    if (short) {
      return short;
    }

    const result = await processAndSendEmail({
      to,
      cc,
      subject,
      text,
      html,
      headers,
      room_id: chat_id,
    });

    if (result.success === false) {
      // No charge — credits are deducted only on a successful send.
      return NextResponse.json(
        { status: "error", error: result.error },
        { status: 502, headers: getCorsHeaders() },
      );
    }

    // Charge on success (best-effort: recordCreditDeduction never throws).
    await recordCreditDeduction({
      accountId,
      creditsToDeduct: EMAIL_CREDIT_COST,
      source: "api",
      modelId: EMAIL_USAGE_MODEL_ID,
    });

    // Admin Telegram ping for quality/frequency review (best-effort, non-blocking).
    await notifyEmailSent({ accountId, to, cc, subject, resendId: result.id });

    return NextResponse.json(
      { success: true, message: result.message, id: result.id },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    // Anything unexpected (e.g. a Stripe error inside the credit gate) returns a
    // controlled 500 with CORS headers instead of an uncaught error.
    console.error("[sendEmailHandler]", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
