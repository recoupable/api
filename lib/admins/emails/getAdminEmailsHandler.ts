import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import { selectAccountEmailIds } from "@/lib/supabase/memory_emails/selectAccountEmailIds";
import { getResendClient } from "@/lib/emails/client";
import type { GetEmailResponseSuccess } from "resend";

/**
 * Handler for GET /api/admins/emails
 *
 * Supports two query modes:
 * - ?account_id=<id> — returns all Resend emails sent for the account
 * - ?email_id=<id> — returns a single email by Resend ID
 *
 * Returns the full Resend GetEmailResponseSuccess object.
 * Requires admin authentication.
 *
 * @param request - The request object
 * @returns A NextResponse with { status: "success", emails: GetEmailResponseSuccess[] }
 */
export async function getAdminEmailsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await validateAdminAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("account_id");
    const emailId = searchParams.get("email_id");

    if (!accountId && !emailId) {
      return NextResponse.json(
        { status: "error", error: "must provide either account_id or email_id" },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    const resend = getResendClient();

    // Single email by Resend ID
    if (emailId) {
      const email = await fetchResendEmail(resend, emailId);
      return NextResponse.json(
        { status: "success", emails: email ? [email] : [] },
        { status: 200, headers: getCorsHeaders() },
      );
    }

    // All emails for an account
    const emailIdRows = await selectAccountEmailIds(accountId!);

    if (emailIdRows.length === 0) {
      return NextResponse.json(
        { status: "success", emails: [] },
        { status: 200, headers: getCorsHeaders() },
      );
    }

    const emails = await Promise.all(
      emailIdRows.map(({ email_id }) => fetchResendEmail(resend, email_id)),
    );

    const validEmails = emails.filter(
      (e): e is GetEmailResponseSuccess => e !== null,
    );

    return NextResponse.json(
      { status: "success", emails: validEmails },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getAdminEmailsHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}

async function fetchResendEmail(
  resend: ReturnType<typeof getResendClient>,
  emailId: string,
): Promise<GetEmailResponseSuccess | null> {
  try {
    const { data } = await resend.emails.get(emailId);
    return data ?? null;
  } catch {
    return null;
  }
}
