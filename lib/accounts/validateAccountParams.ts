import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const accountParamsSchema = z.object({
  id: z.string({ message: "id is required" }).uuid("id must be a valid UUID"),
});

export type AccountParams = z.infer<typeof accountParamsSchema>;

/**
 * Validates account ID from route params.
 *
 * @param id - The account ID from the route params
 * @returns A NextResponse with an error if validation fails, or the validated params if validation passes.
 */
export function validateAccountParams(id: string): NextResponse | AccountParams {
  const result = accountParamsSchema.safeParse({ id });

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

