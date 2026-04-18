import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext, type AuthContext } from "@/lib/auth/validateAuthContext";

const artistIdSchema = z.string({ message: "id is required" }).uuid("id must be a valid UUID");

export interface GetArtistFansRequest {
  artistAccountId: string;
  page: number;
  limit: number;
  authContext: AuthContext;
}

const positiveIntSchema = (field: string) =>
  z
    .number({ message: `${field} must be a positive integer` })
    .int(`${field} must be an integer`)
    .positive(`${field} must be a positive integer`);

const artistFansQuerySchema = z.object({
  page: z.preprocess(
    value => (value === undefined || value === null || value === "" ? 1 : Number(value)),
    positiveIntSchema("page"),
  ),
  limit: z
    .preprocess(
      value => (value === undefined || value === null || value === "" ? 20 : Number(value)),
      positiveIntSchema("limit"),
    )
    .transform(value => Math.min(value, 100)),
});

/**
 * Empty fans envelope used on validation errors so callers get a stable shape.
 */
const emptyFansEnvelope = {
  status: "error" as const,
  fans: [],
  pagination: {
    total_count: 0,
    page: 1,
    limit: 20,
    total_pages: 0,
  },
};

/**
 * Builds a 400 NextResponse with the empty fans envelope shape.
 */
function buildValidationError(message: string, path: Array<string | number>): NextResponse {
  return NextResponse.json(
    {
      ...emptyFansEnvelope,
      error: message,
      missing_fields: path,
    },
    {
      status: 400,
      headers: getCorsHeaders(),
    },
  );
}

/**
 * Validates GET /api/artists/{id}/fans path params, pagination query params, and auth.
 *
 * Path id: required UUID.
 * Query: `page` (default 1, must be >= 1), `limit` (default 20, clamped to max 100).
 * Auth: required via `validateAuthContext` — 401 on missing/invalid credentials.
 *
 * @param request - The incoming request
 * @param id - The artist account ID from the route
 * @returns The validated request context, or a NextResponse error
 */
export async function validateGetArtistFansRequest(
  request: NextRequest,
  id: string,
): Promise<GetArtistFansRequest | NextResponse> {
  // Check auth first so unauthenticated callers always receive 401 regardless
  // of whether the path/query params are valid.
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const idResult = artistIdSchema.safeParse(id);
  if (!idResult.success) {
    const firstError = idResult.error.issues[0];
    return buildValidationError(firstError.message, ["id"]);
  }

  const { searchParams } = new URL(request.url);
  const rawPage = searchParams.get("page");
  const rawLimit = searchParams.get("limit");
  const queryResult = artistFansQuerySchema.safeParse({
    page: rawPage === null || rawPage === "" ? undefined : rawPage,
    limit: rawLimit === null || rawLimit === "" ? undefined : rawLimit,
  });

  if (!queryResult.success) {
    const firstError = queryResult.error.issues[0];
    return buildValidationError(firstError.message, firstError.path as Array<string | number>);
  }

  return {
    artistAccountId: idResult.data,
    page: queryResult.data.page,
    limit: queryResult.data.limit,
    authContext: authResult,
  };
}
