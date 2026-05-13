import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";

export const createTemplateBodySchema = z.object({
  title: z
    .string({ message: "title is required" })
    .min(3, "title must be at least 3 characters")
    .max(50, "title must be at most 50 characters"),
  description: z
    .string({ message: "description is required" })
    .min(10, "description must be at least 10 characters")
    .max(200, "description must be at most 200 characters"),
  prompt: z
    .string({ message: "prompt is required" })
    .min(20, "prompt must be at least 20 characters")
    .max(10000, "prompt must be at most 10000 characters"),
  tags: z.array(z.string(), { message: "tags must be an array of strings" }),
  is_private: z.boolean({ message: "is_private is required" }),
  share_emails: z
    .array(z.string().email("share_emails must contain valid email addresses"))
    .default([]),
});

export type CreateTemplateBody = z.infer<typeof createTemplateBodySchema>;

export interface ValidatedCreateTemplateRequest {
  accountId: string;
  body: CreateTemplateBody;
}

/**
 * Validates POST /api/agents/templates: auth and JSON body.
 */
export async function validateCreateTemplateRequest(
  request: NextRequest,
): Promise<ValidatedCreateTemplateRequest | NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const rawBody = await safeParseJson(request);
  const parsedBody = createTemplateBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    const firstError = parsedBody.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return { accountId: authResult.accountId, body: parsedBody.data };
}
