import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const organizationsQuerySchema = z.object({
  accountId: z.string({ message: "accountId is required" }).uuid("accountId must be a valid UUID"),
});

export type OrganizationsQuery = z.infer<typeof organizationsQuerySchema>;

/**
 * Validates query parameters for GET /api/organizations.
 *
 * @param searchParams - The URL search parameters
 * @returns A NextResponse with an error if validation fails, or the validated query if validation passes.
 */
export function validateOrganizationsQuery(
  searchParams: URLSearchParams,
): NextResponse | OrganizationsQuery {
  const params = Object.fromEntries(searchParams.entries());
  const result = organizationsQuerySchema.safeParse(params);

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

