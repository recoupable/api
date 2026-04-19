import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validationErrorResponse } from "@/lib/zod/validationErrorResponse";
import { paginationQuerySchema } from "@/lib/zod/paginationQuerySchema";

const getArtistFansRequestSchema = paginationQuerySchema().extend({
  artistAccountId: z.string({ error: "id is required" }).uuid("id must be a valid UUID"),
});

export type GetArtistFansParams = z.infer<typeof getArtistFansRequestSchema>;

export async function validateGetArtistFansRequest(request: NextRequest, id: string) {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const { data: validatedRequest, error: validationError } = getArtistFansRequestSchema.safeParse({
    artistAccountId: id,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (validationError) {
    const firstError = validationError.issues[0];
    const path = firstError.path;
    return validationErrorResponse(firstError.message, path);
  }

  return validatedRequest;
}
