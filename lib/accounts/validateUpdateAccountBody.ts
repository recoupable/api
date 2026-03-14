import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const updateAccountBodySchema = z.object({
  accountId: z.string().uuid("accountId must be a valid UUID"),
  name: z.string().optional(),
  instruction: z.string().optional(),
  organization: z.string().optional(),
  image: z.string().url("image must be a valid URL").optional().or(z.literal("")),
  jobTitle: z.string().optional(),
  roleType: z.string().optional(),
  companyName: z.string().optional(),
  knowledges: z.array(z.string()).optional(),
});

export type UpdateAccountBody = z.infer<typeof updateAccountBodySchema>;

/**
 * Validates request body for PATCH /api/accounts.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateUpdateAccountBody(body: unknown): NextResponse | UpdateAccountBody {
  const result = updateAccountBodySchema.safeParse(body);

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
