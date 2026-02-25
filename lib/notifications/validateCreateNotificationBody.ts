import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { z } from "zod";

export const createNotificationBodySchema = z.object({
  cc: z.array(z.string().email("each 'cc' entry must be a valid email")).default([]).optional(),
  subject: z.string({ message: "subject is required" }).min(1, "subject cannot be empty"),
  text: z.string().optional(),
  html: z.string().default("").optional(),
  headers: z.record(z.string(), z.string()).default({}).optional(),
  room_id: z.string().optional(),
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
});

export type CreateNotificationBody = z.infer<typeof createNotificationBodySchema>;

export type ValidatedCreateNotificationRequest = {
  cc?: string[];
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  room_id?: string;
  accountId: string;
};

/**
 * Validates POST /api/notifications request including auth headers, body parsing,
 * schema validation, and account access authorization.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated request data.
 */
export async function validateCreateNotificationBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateNotificationRequest> {
  const body = await safeParseJson(request);
  const result = createNotificationBodySchema.safeParse(body);

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
    cc: result.data.cc,
    subject: result.data.subject,
    text: result.data.text,
    html: result.data.html,
    headers: result.data.headers,
    room_id: result.data.room_id,
    accountId: authContext.accountId,
  };
}
