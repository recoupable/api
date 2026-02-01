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
    entity_type: z.enum(["user", "artist"]).optional().default("user"),
    entity_id: z.string().optional(),
  })
  .refine(
    (data) => {
      // entity_id is required when entity_type is "artist"
      if (data.entity_type === "artist" && !data.entity_id) {
        return false;
      }
      return true;
    },
    {
      message: "entity_id is required when entity_type is 'artist'",
      path: ["entity_id"],
    },
  )
  .refine(
    (data) => {
      // connector must be in ALLOWED_ARTIST_CONNECTORS when entity_type is "artist"
      if (data.entity_type === "artist") {
        return (ALLOWED_ARTIST_CONNECTORS as readonly string[]).includes(data.connector);
      }
      return true;
    },
    {
      message: `Connector is not allowed for artist connections. Allowed: ${ALLOWED_ARTIST_CONNECTORS.join(", ")}`,
      path: ["connector"],
    },
  );

export type AuthorizeConnectorBody = z.infer<typeof authorizeConnectorBodySchema>;

/**
 * Validates request body for POST /api/connectors/authorize.
 *
 * Supports both user and artist connectors:
 * - User: { connector: "googlesheets" }
 * - Artist: { connector: "tiktok", entity_type: "artist", entity_id: "artist-uuid" }
 *
 * Validation includes:
 * - connector is required and non-empty
 * - entity_id is required when entity_type is "artist"
 * - connector must be allowed for artists when entity_type is "artist"
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
