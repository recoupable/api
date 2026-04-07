import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext, type AuthContext } from "@/lib/auth/validateAuthContext";
import { z } from "zod";

export const updateAccountBodySchema = z
  .object({
    accountId: z.string().uuid("accountId must be a valid UUID").optional(),
    name: z.string().optional(),
    instruction: z.string().optional(),
    organization: z.string().optional(),
    image: z.string().url("image must be a valid URL").optional().or(z.literal("")),
    jobTitle: z.string().optional(),
    roleType: z.string().optional(),
    companyName: z.string().optional(),
    knowledges: z.array(z.string()).optional(),
  })
  .refine(
    body => {
      const updateFields = { ...body };
      delete updateFields.accountId;
      return Object.values(updateFields).some(v => v !== undefined);
    },
    {
      message: "At least one update field is required",
      path: ["body"],
    },
  );

export type UpdateAccountBody = z.infer<typeof updateAccountBodySchema>;

/**
 * Validates request body for PATCH /api/accounts.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateUpdateAccountBody(body: unknown): NextResponse | UpdateAccountBody {
  const result = updateAccountBodySchema.safeParse(body);

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

  return result.data;
}

/** Successful auth + parsed body for PATCH /api/accounts (after validatePatchAccountRequest). */
export type PatchAccountRequestValidated = {
  auth: AuthContext;
  body: UpdateAccountBody;
};

/**
 * Authenticates the request, parses JSON, and validates the PATCH /api/accounts body.
 * Keeps HTTP auth + input validation out of the account patch handler (SRP).
 *
 * @param req - Incoming Next.js request
 * @returns Error response, or auth context plus validated body fields
 */
export async function validatePatchAccountRequest(
  req: NextRequest,
): Promise<NextResponse | PatchAccountRequestValidated> {
  const authResult = await validateAuthContext(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const rawBody = await safeParseJson(req);
  const validated = validateUpdateAccountBody(rawBody);
  if (validated instanceof NextResponse) {
    return validated;
  }

  return { auth: authResult, body: validated };
}
