import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const getCatalogsQuerySchema = z.object({
  account_id: z
    .string()
    .min(1, "account_id parameter is required")
    .describe("The ID of the account."),
});

export type GetCatalogsQuery = z.infer<typeof getCatalogsQuerySchema>;

/**
 * Validates get catalogs query parameters from a NextRequest.
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with an error if validation fails, or the validated query parameters if validation passes.
 */
export function validateGetCatalogsQuery(request: NextRequest): NextResponse | GetCatalogsQuery {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  const validationResult = getCatalogsQuerySchema.safeParse(params);

  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
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

  return validationResult.data;
}
