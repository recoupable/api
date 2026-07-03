import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canManageOrgMembers } from "@/lib/organizations/canManageOrgMembers";
import { z } from "zod";

const addOrgMemberBodySchema = z
  .object({
    organizationId: z
      .string({ message: "organizationId is required" })
      .uuid("organizationId must be a valid UUID"),
    accountId: z.string().uuid("accountId must be a valid UUID").optional(),
    email: z.string().email("email must be a valid email address").optional(),
  })
  .refine(data => (data.accountId ? !data.email : !!data.email), {
    message: "Provide exactly one of accountId or email",
  });

export type AddOrgMemberBody = z.infer<typeof addOrgMemberBodySchema>;

export interface AddOrgMemberRequestData {
  /** The authenticated caller's account ID */
  callerAccountId: string;
  /** The validated request body */
  body: AddOrgMemberBody;
}

/**
 * Validates POST /api/organizations/members requests.
 * Handles authentication (x-api-key or Authorization bearer token),
 * body validation, and the caller's access to manage org members.
 *
 * Body parameters:
 * - organizationId (required): The organization's account ID
 * - accountId or email (exactly one): The member to add
 *
 * The caller must be a member of the organization or a Recoup admin.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error (400/401/403) if validation fails,
 *   or the caller account ID and validated body.
 */
export async function validateAddOrgMemberRequest(
  request: NextRequest,
): Promise<NextResponse | AddOrgMemberRequestData> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const rawBody = await request.json().catch(() => null);
  const result = addOrgMemberBodySchema.safeParse(rawBody);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        message: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  const hasAccess = await canManageOrgMembers({
    accountId: authResult.accountId,
    organizationId: result.data.organizationId,
  });

  if (!hasAccess) {
    return NextResponse.json(
      {
        status: "error",
        message: "Caller is not a member of the organization",
      },
      {
        status: 403,
        headers: getCorsHeaders(),
      },
    );
  }

  return {
    callerAccountId: authResult.accountId,
    body: result.data,
  };
}
