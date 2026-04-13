import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { knowledgeSchema } from "@/lib/artist/knowledge";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";

export const updateArtistBodySchema = z
  .object({
    name: z.string().optional(),
    image: z.string().url("image must be a valid URL").or(z.literal("")).optional(),
    instruction: z.string().optional(),
    label: z.string().optional(),
    knowledges: z.array(knowledgeSchema).optional(),
    profileUrls: z.record(z.string(), z.string()).optional(),
  })
  .refine(data => Object.values(data).some(value => value !== undefined), {
    message: "At least one field to update must be provided",
  });

export type UpdateArtistBody = z.infer<typeof updateArtistBodySchema>;

export type ValidatedUpdateArtistRequest = UpdateArtistBody & {
  artistId: string;
  requesterAccountId: string;
};

/**
 * Validates PATCH /api/artists/{id} path params, auth, access, and body.
 */
export async function validateUpdateArtistRequest(
  request: NextRequest,
  id: string,
): Promise<ValidatedUpdateArtistRequest | NextResponse> {
  const validatedParams = validateAccountParams(id);
  if (validatedParams instanceof NextResponse) {
    return validatedParams;
  }

  const body = await safeParseJson(request);
  const parsedBody = updateArtistBodySchema.safeParse(body);

  if (!parsedBody.success) {
    const firstError = parsedBody.error.issues[0];
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

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const artistId = validatedParams.id;
  const requesterAccountId = authResult.accountId;

  const existingArtist = await selectAccounts(artistId);
  if (!existingArtist.length) {
    return NextResponse.json(
      {
        status: "error",
        error: "Artist not found",
      },
      {
        status: 404,
        headers: getCorsHeaders(),
      },
    );
  }

  const hasAccess = await checkAccountArtistAccess(requesterAccountId, artistId);
  if (!hasAccess) {
    return NextResponse.json(
      {
        status: "error",
        error: "Forbidden",
      },
      {
        status: 403,
        headers: getCorsHeaders(),
      },
    );
  }

  return {
    artistId,
    requesterAccountId,
    ...parsedBody.data,
  };
}
