import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const getApiKeysQuerySchema = z.object({
  account_id: z.string().min(1, "account_id parameter is required"),
});

export type GetApiKeysQuery = z.infer<typeof getApiKeysQuerySchema>;

/**
 * Validates get API keys query parameters.
 *
 * @param searchParams - The URL search parameters to validate.
 * @returns A NextResponse with an error if validation fails, or the validated query parameters if validation passes.
 */
export function validateGetApiKeysQuery(
  searchParams: URLSearchParams,
): NextResponse | GetApiKeysQuery {
  const params = Object.fromEntries(searchParams.entries());

  const validationResult = getApiKeysQuerySchema.safeParse(params);

  if (!validationResult.success) {
    return NextResponse.json(
      {
        status: "error",
        message: "Invalid input",
        errors: validationResult.error.issues.map(err => ({
          field: err.path.join("."),
          message: err.message,
        })),
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  return validationResult.data;
}
