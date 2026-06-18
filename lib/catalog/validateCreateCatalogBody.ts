import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

const materializationSourceSchema = z.object({
  snapshot_id: z.string().uuid("snapshot_id must be a valid UUID"),
});

export const createCatalogBodySchema = z
  .object({
    name: z.string().min(1, "name must not be empty").optional(),
    from: materializationSourceSchema.optional(),
  })
  .refine(data => data.name !== undefined || data.from !== undefined, {
    message: "Provide at least one of name or from",
  });

export type CreateCatalogBody = z.infer<typeof createCatalogBodySchema>;

/**
 * Validates a create-catalog request body.
 *
 * Accepts `{ name?, from?: { snapshot_id } }`; at least one of `name` or
 * `from` is required. The owning account is never taken from the body - it is
 * resolved from the request credentials by the handler.
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
