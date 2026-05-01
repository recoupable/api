import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const deleteApiKeyBodySchema = z.object({
  id: z.string().min(1, "id parameter is required"),
});

export type DeleteApiKeyBody = z.infer<typeof deleteApiKeyBodySchema>;

/**
 * Validates delete API key request body.
 *
 * @param body - The request body to validate.
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateDeleteApiKeyBody(body: unknown): NextResponse | DeleteApiKeyBody {
  const validationResult = deleteApiKeyBodySchema.safeParse(body);

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
