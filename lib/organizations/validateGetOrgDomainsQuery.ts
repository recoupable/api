import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const getOrgDomainsQuerySchema = z.object({
  organization_id: z
    .string({ message: "organization_id is required" })
    .uuid("organization_id must be a valid UUID"),
});

export type GetOrgDomainsQuery = z.infer<typeof getOrgDomainsQuerySchema>;

/**
 * Validates query parameters for GET /api/organizations/domains.
 *
 * @param request - The request object
 * @returns A NextResponse with an error if validation fails, or the validated query if validation passes.
 */
export function validateGetOrgDomainsQuery(
  request: NextRequest,
): NextResponse | GetOrgDomainsQuery {
  const { searchParams } = new URL(request.url);
  const result = getOrgDomainsQuerySchema.safeParse({
    organization_id: searchParams.get("organization_id") ?? undefined,
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
