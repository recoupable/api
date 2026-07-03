import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const removeOrgMemberQuerySchema = z.object({
  organization_id: z
    .string({ message: "organization_id is required" })
    .uuid("organization_id must be a valid UUID"),
  account_id: z
    .string({ message: "account_id is required" })
    .uuid("account_id must be a valid UUID"),
});

export type RemoveOrgMemberQuery = z.infer<typeof removeOrgMemberQuerySchema>;

/**
 * Validates query parameters for DELETE /api/organizations/members.
 *
 * @param request - The request object containing the query parameters
 * @returns A NextResponse with an error if validation fails, or the validated query if validation passes.
 */
export function validateRemoveOrgMemberQuery(
  request: NextRequest,
): NextResponse | RemoveOrgMemberQuery {
  const searchParams = request.nextUrl.searchParams;
  const result = removeOrgMemberQuerySchema.safeParse({
    organization_id: searchParams.get("organization_id") ?? undefined,
    account_id: searchParams.get("account_id") ?? undefined,
  });

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

  return result.data;
}
