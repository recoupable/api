import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canManageOrganization } from "@/lib/organizations/canManageOrganization";
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
    return errorResponse(result.error.issues[0].message, 400);
  }

  const hasAccess = await canManageOrganization({
    accountId: authResult.accountId,
    organizationId: result.data.organizationId,
  });

  if (!hasAccess) {
    return errorResponse("Caller is not a member of the organization", 403);
  }

  return {
    callerAccountId: authResult.accountId,
    body: result.data,
  };
}
