import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { z } from "zod";

export const sendEmailBodySchema = z.object({
  to: z
    .array(z.string().email("each 'to' entry must be a valid email"))
    .min(1, "to must include at least one recipient"),
  cc: z.array(z.string().email("each 'cc' entry must be a valid email")).default([]).optional(),
  subject: z.string({ message: "subject is required" }).min(1, "subject cannot be empty"),
  text: z.string().optional(),
  html: z.string().default("").optional(),
  headers: z.record(z.string(), z.string()).default({}).optional(),
  chat_id: z.string().optional(),
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
});

export type SendEmailBody = z.infer<typeof sendEmailBodySchema>;

export type ValidatedSendEmailRequest = {
  to: string[];
  cc?: string[];
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  chat_id?: string;
  accountId: string;
};

/**
 * Validates POST /api/emails: parses the body against the schema, then
 * authenticates via validateAuthContext (x-api-key or Bearer). Unlike
 * /api/notifications (which emails the account's own address), this endpoint
 * takes an explicit `to` recipient list.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation/auth fails, or the validated request data.
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

  return {
    to: result.data.to,
    cc: result.data.cc,
    subject: result.data.subject,
    text: result.data.text,
    html: result.data.html,
    headers: result.data.headers,
    chat_id: result.data.chat_id,
    accountId: authContext.accountId,
  };
}
