import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const createCatalogBodySchema = z
  .object({
    name: z.string().min(1, "name must not be empty").optional(),
    snapshot: z.string().uuid("snapshot must be a valid UUID").optional(),
    organization_id: z.string().uuid("organization_id must be a valid UUID").optional(),
  })
  .refine(data => data.name !== undefined || data.snapshot !== undefined, {
    message: "Provide at least one of name or snapshot",
  });

export type CreateCatalogBody = z.infer<typeof createCatalogBodySchema>;

/**
 * Validates a create-catalog request body.
 *
 * Accepts `{ name?, snapshot?, organization_id? }`; at least one of `name` or
 * `snapshot` is required. `snapshot` is a completed playcount snapshot id
 * (valuation run) to materialize from.
 *
 * `organization_id` names an organization to own the catalog instead of the
 * caller (chat#1938). It is not an account override: the handler still resolves
 * the caller from credentials and authorizes membership via `validateAuthContext`,
 * which 403s a caller who does not belong to the organization. Absent, the
 * catalog is owned by the calling account as before.
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
