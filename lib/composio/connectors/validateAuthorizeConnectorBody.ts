import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const authorizeConnectorBodySchema = z.object({
  connector: z
    .string({ message: "connector is required" })
    .min(1, "connector cannot be empty (e.g., 'googlesheets', 'tiktok')"),
  callback_url: z.string().url("callback_url must be a valid URL").optional(),
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
});

export type AuthorizeConnectorBody = z.infer<typeof authorizeConnectorBodySchema>;

/**
 * Validates request body for POST /api/connectors/authorize.
 *
 * Validates structure only (connector, callback_url, account_id).
 * Connector restriction for artists is enforced in validateAuthorizeConnectorRequest
 * after the entity type is determined via the access check.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateAuthorizeConnectorBody(
  body: unknown,
): NextResponse | AuthorizeConnectorBody {
  const result = authorizeConnectorBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
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
