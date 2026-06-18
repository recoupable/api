import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const createCatalogBodySchema = z
  .object({
    name: z.string().min(1, "name must not be empty").optional(),
    snapshot: z.string().uuid("snapshot must be a valid UUID").optional(),
  })
  .refine(data => data.name !== undefined || data.snapshot !== undefined, {
    message: "Provide at least one of name or snapshot",
  });

export type CreateCatalogBody = z.infer<typeof createCatalogBodySchema>;

/**
 * Validates a create-catalog request body.
 *
 * Accepts `{ name?, snapshot? }`; at least one is required. `snapshot` is a
 * completed playcount snapshot id (valuation run) to materialize from. The
 * owning account is never taken from the body - it is resolved from the
 * request credentials by the handler.
 *
 * @param body - The parsed request body to validate.
 * @returns A NextResponse with a 400 error if validation fails, or the
 *   validated body if it passes.
 */
export function validateCreateCatalogBody(body: unknown): NextResponse | CreateCatalogBody {
  const result = createCatalogBodySchema.safeParse(body);

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
