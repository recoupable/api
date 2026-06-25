import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { assertRecipientsAllowed } from "@/lib/emails/assertRecipientsAllowed";
import { resolveEmailSubject } from "@/lib/emails/resolveEmailSubject";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { z } from "zod";

export const sendEmailBodySchema = z.object({
  to: z
    .array(z.string().email("each 'to' entry must be a valid email"))
    .min(1, "to must include at least one recipient")
    .optional(),
  cc: z.array(z.string().email("each 'cc' entry must be a valid email")).default([]).optional(),
  subject: z.string().optional(),
  text: z.string().optional(),
  html: z.string().default("").optional(),
  headers: z.record(z.string(), z.string()).default({}).optional(),
  chat_id: z.string().optional(),
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
});

export type SendEmailBody = z.infer<typeof sendEmailBodySchema>;

export type ValidatedSendEmailRequest = Omit<SendEmailBody, "to" | "subject"> & {
  to: string[];
  subject: string;
  accountId: string;
};

/**
 * Validates POST /api/emails: parses the body, authenticates via
 * validateAuthContext (x-api-key or Bearer), resolves the recipients, then
 * enforces the recipient restriction (without a payment method on file,
 * `to`/`cc` are limited to the account's own email).
 *
 * `to` is optional: when omitted, the email defaults to the authenticated
 * account's own email address(es) (via `account_emails`), so a caller can
 * "email me this" without restating their address. `subject` is optional too:
 * when omitted it defaults to the body's first heading/line, else
 * `Message from Recoup`. Returns the resolved `to` + `subject`.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation/auth/recipients fail, or the validated request data.
 */
export async function validateSendEmailBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedSendEmailRequest> {
  const body = await safeParseJson(request);
  const result = sendEmailBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  const authContext = await validateAuthContext(request, {
    accountId: result.data.account_id,
  });

  if (authContext instanceof NextResponse) {
    return authContext;
  }

  let to = result.data.to ?? [];
  if (to.length === 0) {
    const ownRows = await selectAccountEmails({ accountIds: authContext.accountId });
    to = ownRows.map(row => row.email);
    if (to.length === 0) {
      return NextResponse.json(
        {
          status: "error",
          error: "No email address found for the authenticated account.",
        },
        { status: 400, headers: getCorsHeaders() },
      );
    }
  }

  const recipientCheck = await assertRecipientsAllowed({
    accountId: authContext.accountId,
    recipients: [...to, ...(result.data.cc ?? [])],
  });
  if (recipientCheck.allowed === false) {
    return NextResponse.json(
      {
        status: "error",
        error: `Without a payment method on file, emails can only be sent to the account's own address. Disallowed recipients: ${recipientCheck.disallowed.join(", ")}. Add a payment method to send to any recipient.`,
        disallowed_recipients: recipientCheck.disallowed,
      },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  const subject = resolveEmailSubject({
    subject: result.data.subject,
    text: result.data.text,
    html: result.data.html,
  });

  return {
    ...result.data,
    to,
    subject,
    accountId: authContext.accountId,
  };
}
