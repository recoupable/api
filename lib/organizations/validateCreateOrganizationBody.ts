import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const createOrganizationBodySchema = z.object({
  name: z.string({ message: "name is required" }).min(1, "name cannot be empty"),
  accountId: z.string({ message: "accountId is required" }).uuid("accountId must be a valid UUID"),
});

export type CreateOrganizationBody = z.infer<typeof createOrganizationBodySchema>;

/**
 * Validates request body for POST /api/organizations.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateCreateOrganizationBody(
  body: unknown,
): NextResponse | CreateOrganizationBody {
  const result = createOrganizationBodySchema.safeParse(body);

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

