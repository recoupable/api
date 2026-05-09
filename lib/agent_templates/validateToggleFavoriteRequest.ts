import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";

export const toggleFavoriteBodySchema = z.object({
  is_favourite: z.boolean({ message: "is_favourite is required" }),
});

export type ToggleFavoriteBody = z.infer<typeof toggleFavoriteBodySchema>;

export interface ValidatedToggleFavoriteRequest {
  templateId: string;
  accountId: string;
  isFavourite: boolean;
}

/**
 * Validates PUT /api/agent-templates/{id}/favorite: id format, auth, and the
 * `{ is_favourite: boolean }` body.
 *
 * @param request - The incoming request
 * @param id - The template id from the route
 * @returns Validated payload, or a NextResponse error.
 */
export async function validateToggleFavoriteRequest(
  request: NextRequest,
  id: string,
): Promise<ValidatedToggleFavoriteRequest | NextResponse> {
  const validatedParams = validateAccountParams(id);
  if (validatedParams instanceof NextResponse) return validatedParams;

  const body = await safeParseJson(request);
  const parsedBody = toggleFavoriteBodySchema.safeParse(body);
  if (!parsedBody.success) {
    const firstError = parsedBody.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  return {
    templateId: validatedParams.id,
    accountId: authResult.accountId,
    isFavourite: parsedBody.data.is_favourite,
  };
}
