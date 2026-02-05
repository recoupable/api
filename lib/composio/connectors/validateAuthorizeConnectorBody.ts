import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";
import { ALLOWED_ARTIST_CONNECTORS } from "./isAllowedArtistConnector";

export const authorizeConnectorBodySchema = z
  .object({
    connector: z
      .string({ message: "connector is required" })
      .min(1, "connector cannot be empty (e.g., 'googlesheets', 'tiktok')"),
    callback_url: z.string().url("callback_url must be a valid URL").optional(),
    account_id: z.string().uuid("account_id must be a valid UUID").optional(),
  })
  .refine(
    data => {
      // connector must be in ALLOWED_ARTIST_CONNECTORS when account_id is provided
      if (data.account_id) {
        return (ALLOWED_ARTIST_CONNECTORS as readonly string[]).includes(data.connector);
      }
      return true;
    },
    {
      message: `Connector is not allowed for this entity. Allowed: ${ALLOWED_ARTIST_CONNECTORS.join(", ")}`,
      path: ["connector"],
    },
  );

export type AuthorizeConnectorBody = z.infer<typeof authorizeConnectorBodySchema>;

/**
 * Validates request body for POST /api/connectors/authorize.
 *
 * - User connection: { connector: "googlesheets" }
 * - Entity connection: { connector: "tiktok", account_id: "account-uuid" }
 *
 * When account_id is provided:
 * - Uses that account ID as the Composio entity
 * - Validates connector is allowed for that entity type
 *
 * When account_id is not provided:
 * - Uses the authenticated account ID
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
