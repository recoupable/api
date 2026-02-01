import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const getConnectorsQuerySchema = z
  .object({
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
  );

export type GetConnectorsQuery = z.infer<typeof getConnectorsQuerySchema>;

/**
 * Validates query params for GET /api/connectors.
 *
 * Supports both user and artist connectors:
 * - User: No params required (defaults to entity_type=user)
 * - Artist: entity_type=artist&entity_id=artist-uuid
 *
 * @param searchParams - The URL search params
 * @returns A NextResponse with an error if validation fails, or the validated query if validation passes.
 */
export function validateGetConnectorsQuery(
  searchParams: URLSearchParams,
): NextResponse | GetConnectorsQuery {
  const queryParams = {
    entity_type: searchParams.get("entity_type") ?? undefined,
    entity_id: searchParams.get("entity_id") ?? undefined,
  };

  const result = getConnectorsQuerySchema.safeParse(queryParams);

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
