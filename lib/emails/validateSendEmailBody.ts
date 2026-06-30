import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { assertRecipientsAllowed } from "@/lib/emails/assertRecipientsAllowed";
import { resolveEmailSubject } from "@/lib/emails/resolveEmailSubject";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { readRawBody } from "@/lib/networking/readRawBody";
import { z } from "zod";

export const sendEmailBodySchema = z
  .object({
    to: z
      .array(z.string().email("each 'to' entry must be a valid email"))
      .min(1, "to must include at least one recipient")
      .optional(),
    cc: z.array(z.string().email("each 'cc' entry must be a valid email")).default([]).optional(),
    subject: z.string().optional(),
    text: z.string().optional(),
    html: z.string().optional(),
    headers: z.record(z.string(), z.string()).default({}).optional(),
    chat_id: z.string().optional(),
    account_id: z.string().uuid("account_id must be a valid UUID").optional(),
  })
  // Guard: never send an empty/footer-only email. A malformed or empty body
  // parses to `{}` (readRawBody -> JSON.parse, `{}` on failure), which has
  // neither field — so both that and an explicit body-less request fail here and
  // return 400 instead of silently sending "Message from Recoup" + footer.
  .refine(data => Boolean(data.html?.trim() || data.text?.trim()), {
    message: "a non-empty html or text body is required",
    path: ["html"],
  });

export type SendEmailBody = z.infer<typeof sendEmailBodySchema>;

export type ValidatedSendEmailRequest = Omit<SendEmailBody, "to" | "subject"> & {
  to: string[];
  subject: string;
  accountId: string;
};

/**
 * Validation outcome. Always carries `rawBody` — the request body as received —
 * so the handler can record it in `email_send_log` on both the rejected and the
 * accepted paths without re-reading the request.
 */
export type ValidateSendEmailResult =
  | { rawBody: string; error: NextResponse }
  | { rawBody: string; data: ValidatedSendEmailRequest };

/**
 * Validates POST /api/emails: reads the raw body, parses + schema-checks it,
 * authenticates (x-api-key or Bearer), resolves the recipients, and enforces the
 * recipient restriction. `to` defaults to the account's own email when omitted;
 * `subject` is derived from the body when omitted. Always returns `rawBody`.
 *
 * @param request - The NextRequest object
 * @returns `{ rawBody, error }` if validation/auth/recipients fail, else `{ rawBody, data }`.
 */
export async function validateSendEmailBody(
  request: NextRequest,
): Promise<ValidateSendEmailResult> {
  const rawBody = await readRawBody(request);
  let parsed: unknown = {};
  if (rawBody) {
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = {};
    }
  }

  const result = sendEmailBodySchema.safeParse(parsed);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return {
      rawBody,
      error: NextResponse.json(
        { status: "error", missing_fields: firstError.path, error: firstError.message },
        { status: 400, headers: getCorsHeaders() },
      ),
    };
  }

  const authContext = await validateAuthContext(request, { accountId: result.data.account_id });
  if (authContext instanceof NextResponse) {
    return { rawBody, error: authContext };
  }

  let to = result.data.to ?? [];
  if (to.length === 0) {
    const ownRows = await selectAccountEmails({ accountIds: authContext.accountId });
    to = ownRows.map(row => row.email);
    if (to.length === 0) {
      return {
        rawBody,
        error: NextResponse.json(
          { status: "error", error: "No email address found for the authenticated account." },
          { status: 400, headers: getCorsHeaders() },
        ),
      };
    }
  }

  const recipientCheck = await assertRecipientsAllowed({
    accountId: authContext.accountId,
    recipients: [...to, ...(result.data.cc ?? [])],
  });
  if (recipientCheck.allowed === false) {
    return {
      rawBody,
      error: NextResponse.json(
        {
          status: "error",
          error: `Without a payment method on file, emails can only be sent to the account's own address. Disallowed recipients: ${recipientCheck.disallowed.join(", ")}. Add a payment method to send to any recipient.`,
          disallowed_recipients: recipientCheck.disallowed,
        },
        { status: 403, headers: getCorsHeaders() },
      ),
    };
  }

  const subject = resolveEmailSubject({
    subject: result.data.subject,
    text: result.data.text,
    html: result.data.html,
  });

  return { rawBody, data: { ...result.data, to, subject, accountId: authContext.accountId } };
}
