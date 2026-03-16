import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import { selectAccountEmailIds } from "@/lib/supabase/memory_emails/selectAccountEmailIds";
import { getResendClient } from "@/lib/emails/client";

export interface PulseEmailRow {
  id: string;
  subject: string | null;
  to: string[];
  from: string | null;
  html: string | null;
  created_at: string;
}

/**
 * Handler for GET /api/admins/emails?account_id=<id>
 *
 * Returns all Resend emails sent for a given account, including HTML content.
 * Requires admin authentication.
 *
 * @param request - The request object
 * @returns A NextResponse with { status: "success", emails: PulseEmailRow[] }
 */
export async function getAdminEmailsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await validateAdminAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("account_id");

    if (!accountId) {
      return NextResponse.json(
        { status: "error", error: "account_id query param is required" },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    const emailIdRows = await selectAccountEmailIds(accountId);

    if (emailIdRows.length === 0) {
      return NextResponse.json(
        { status: "success", emails: [] },
        { status: 200, headers: getCorsHeaders() },
      );
    }

    const resend = getResendClient();

    const emails = await Promise.all(
      emailIdRows.map(async ({ email_id, created_at }) => {
        try {
          const { data } = await resend.emails.get(email_id);
          if (!data) return null;
          return {
            id: email_id,
            subject: data.subject ?? null,
            to: Array.isArray(data.to) ? data.to : [data.to].filter(Boolean),
            from: data.from ?? null,
            html: data.html ?? null,
            created_at,
          } satisfies PulseEmailRow;
        } catch {
          return null;
        }
      }),
    );

    const validEmails = emails.filter((e): e is PulseEmailRow => e !== null);

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
