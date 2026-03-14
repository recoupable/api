import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const deleteTaskBodySchema = z.object({
  id: z.string().min(1, "id parameter is required").describe("UUID of the task to delete"),
});

export type DeleteTaskBody = z.infer<typeof deleteTaskBodySchema>;

/**
 * Validates delete task request body.
 *
 * @param body - The request body to validate.
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateDeleteTaskBody(body: unknown): NextResponse | DeleteTaskBody {
  const validationResult = deleteTaskBodySchema.safeParse(body);

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
