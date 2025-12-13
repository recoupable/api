import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const createApiKeyBodySchema = z.object({
  key_name: z.string().min(1, "key_name parameter is required"),
});

export type CreateApiKeyBody = z.infer<typeof createApiKeyBodySchema>;

/**
 * Validates create API key request body.
 *
 * @param body - The request body to validate.
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateCreateApiKeyBody(body: unknown): NextResponse | CreateApiKeyBody {
  const validationResult = createApiKeyBodySchema.safeParse(body);

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
