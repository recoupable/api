import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { z } from "zod";

const knowledgeSchema = z.object({
  name: z.string(),
  url: z.string().url("knowledges.url must be a valid URL"),
  type: z.string(),
});

export const updateAccountRequestSchema = z.object({
  accountId: z.string().uuid("accountId must be a valid UUID"),
  name: z.string().optional(),
  instruction: z.string().optional(),
  organization: z.string().optional(),
  image: z.string().url("image must be a valid URL").optional().or(z.literal("")),
  jobTitle: z.string().optional(),
  roleType: z.string().optional(),
  companyName: z.string().optional(),
  knowledges: z.array(knowledgeSchema).optional(),
});

export type UpdateAccountRequest = z.infer<typeof updateAccountRequestSchema>;

/**
 * Validates PATCH /api/accounts including auth, account override access, and body schema.
 */
export async function validateUpdateAccountRequest(
  request: NextRequest,
): Promise<NextResponse | UpdateAccountRequest> {
  const body = await safeParseJson(request);
  const result = updateAccountRequestSchema.safeParse(body);

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
    accountId: result.data.accountId,
  });

  if (authContext instanceof NextResponse) {
    return authContext;
  }

  return {
    ...result.data,
    accountId: authContext.accountId,
  };
}
