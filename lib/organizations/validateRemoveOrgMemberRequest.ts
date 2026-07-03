import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canManageOrganization } from "@/lib/organizations/canManageOrganization";
import { z } from "zod";

const removeOrgMemberQuerySchema = z.object({
  organization_id: z
    .string({ message: "organization_id is required" })
    .uuid("organization_id must be a valid UUID"),
  account_id: z
    .string({ message: "account_id is required" })
    .uuid("account_id must be a valid UUID"),
});

export type RemoveOrgMemberQuery = z.infer<typeof removeOrgMemberQuerySchema>;

export interface RemoveOrgMemberRequestData {
  /** The authenticated caller's account ID */
  callerAccountId: string;
  /** The validated query parameters */
  query: RemoveOrgMemberQuery;
}

/**
 * Validates DELETE /api/organizations/members requests.
 * Handles authentication (x-api-key or Authorization bearer token),
 * query validation, and the caller's access to manage org members.
 *
 * Query parameters:
 * - organization_id (required): The organization's account ID
 * - account_id (required): The member's account ID
 *
 * The caller must be a member of the organization or a Recoup admin.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error (400/401/403) if validation fails,
 *   or the caller account ID and validated query.
 */
export async function validateRemoveOrgMemberRequest(
  request: NextRequest,
): Promise<NextResponse | RemoveOrgMemberRequestData> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const searchParams = request.nextUrl.searchParams;
  const result = removeOrgMemberQuerySchema.safeParse({
    organization_id: searchParams.get("organization_id") ?? undefined,
    account_id: searchParams.get("account_id") ?? undefined,
  });

  if (!result.success) {
    return errorResponse(result.error.issues[0].message, 400);
  }

  const hasAccess = await canManageOrganization({
    accountId: authResult.accountId,
    organizationId: result.data.organization_id,
  });

  if (!hasAccess) {
    return errorResponse("Caller is not a member of the organization", 403);
  }

  return {
    callerAccountId: authResult.accountId,
    query: result.data,
  };
}
