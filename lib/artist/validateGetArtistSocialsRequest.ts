import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext, type AuthContext } from "@/lib/auth/validateAuthContext";

const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .default("20")
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(100)),
});

export interface GetArtistSocialsRequest {
  artistAccountId: string;
  page: number;
  limit: number;
  authContext: AuthContext;
}

/**
 * Validates GET /api/artists/{id}/socials path params, query params, and authentication.
 *
 * Order of checks:
 * 1. Path-segment `id` must be a valid UUID (400 on failure).
 * 2. Optional `page`/`limit` query params parse to positive integers (400 on failure).
 * 3. Auth headers validated via `validateAuthContext` (401 on missing/invalid).
 *
 * @param request - The incoming NextRequest
 * @param id - The artist account ID from the route
 * @returns The validated payload, or a NextResponse error
 */
export async function validateGetArtistSocialsRequest(
  request: NextRequest,
  id: string,
): Promise<GetArtistSocialsRequest | NextResponse> {
  const validatedParams = validateAccountParams(id);
  if (validatedParams instanceof NextResponse) {
    return validatedParams;
  }

  const { searchParams } = new URL(request.url);
  const queryResult = paginationSchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!queryResult.success) {
    const firstError = queryResult.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
        socials: [],
        pagination: {
          total_count: 0,
          page: 1,
          limit: 20,
          total_pages: 0,
        },
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  return {
    artistAccountId: validatedParams.id,
    page: queryResult.data.page,
    limit: queryResult.data.limit,
    authContext: authResult,
  };
}
