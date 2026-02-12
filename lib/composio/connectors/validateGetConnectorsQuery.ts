import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const getConnectorsQuerySchema = z.object({
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
});

export type GetConnectorsQuery = z.infer<typeof getConnectorsQuerySchema>;

/**
 * Validates query params for GET /api/connectors.
 *
 * - No params: Returns connectors for the authenticated account
 * - account_id=uuid: Returns connectors for that entity (after access check)
 *
 * @param searchParams - The URL search params
 * @returns A NextResponse with an error if validation fails, or the validated query if validation passes.
 */
export function validateGetConnectorsQuery(
  searchParams: URLSearchParams,
): NextResponse | GetConnectorsQuery {
  const queryParams = {
    account_id: searchParams.get("account_id") ?? undefined,
  };

  const result = getConnectorsQuerySchema.safeParse(queryParams);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
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
