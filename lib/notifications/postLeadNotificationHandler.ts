import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validatePostLeadBody } from "@/lib/notifications/validatePostLeadBody";
import { buildLeadNotification } from "@/lib/notifications/buildLeadNotification";
import { sendSalesNotification } from "@/lib/telegram/sendSalesNotification";
import { isTestEmail } from "@/lib/emails/isTestEmail";

/**
 * Handler for POST /api/notifications/lead.
 *
 * Pages a human on Telegram when the marketing site captures a lead. The
 * notifier itself already existed and ran in production for Stripe events; it
 * was simply unreachable over HTTP, so no marketing capture ever announced
 * itself (recoupable/chat#1800).
 *
 * Unauthenticated by decision (chat#1800, 2026-08-12): the capture forms that
 * feed it are public anyway, so a bearer secret only stops direct curls, not
 * spam. If abuse materializes, add auth then.
 *
 * Always 200s once the body is valid. The lead is already stored in Attio by
 * the time this is called, so a Telegram outage must not tell the caller the
 * capture failed — that would trade a silent loss for a false alarm.
 *
 * @param request - The incoming request
 * @returns 200 with whether a message was sent, or 400 on rejection.
 */
export async function postLeadNotificationHandler(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const validated = validatePostLeadBody(body);
  if (validated instanceof NextResponse) return validated;

  // sendSalesNotification applies this filter itself, and must keep doing so for
  // its eight Stripe callers. Reading it here is what lets the response state
  // whether a message went out, so the test-address case is assertable over HTTP
  // instead of by watching a Telegram channel.
  const notified = !isTestEmail(validated.email);

  await sendSalesNotification({
    email: validated.email,
    text: buildLeadNotification(validated),
  }).catch(error => {
    console.error("[notifications/lead] notifier failed:", error);
  });

  return NextResponse.json(
    { status: "success", notified },
    { status: 200, headers: getCorsHeaders() },
  );
}
