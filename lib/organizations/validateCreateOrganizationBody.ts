import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const createOrganizationBodySchema = z.object({
  name: z.string().min(1, "name is required"),
  accountId: z.string().uuid("accountId must be a valid UUID"),
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

