import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const createAccountBodySchema = z.object({
  email: z.string().email("email must be a valid email address").optional(),
  wallet: z.string().min(1, "wallet cannot be empty").optional(),
});

export type CreateAccountBody = z.infer<typeof createAccountBodySchema>;

/**
 * Validates request body for POST /api/accounts.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateCreateAccountBody(body: unknown): NextResponse | CreateAccountBody {
  const result = createAccountBodySchema.safeParse(body);

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
