import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { selectAgentTemplates } from "@/lib/supabase/agent_templates/selectAgentTemplates";
import { selectAgentTemplateShares } from "@/lib/supabase/agent_template_shares/selectAgentTemplateShares";

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
 * Validates PUT /api/agents/templates/{id}/favorite: auth, id format, body,
 * and that the caller can see the template (own, public, or shared).
 */
export async function validateToggleFavoriteRequest(
  request: NextRequest,
  id: string,
): Promise<ValidatedToggleFavoriteRequest | NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

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

  const templateId = validatedParams.id;
  const accountId = authResult.accountId;

  const [existing] = await selectAgentTemplates({ id: templateId });
  if (!existing) {
    return NextResponse.json(
      { status: "error", error: "Template not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  const isOwner = existing.creator?.id === accountId;
  let canAccess = isOwner || !existing.is_private;
  if (!canAccess) {
    const shares = await selectAgentTemplateShares({ templateId, accountId });
    canAccess = shares.length > 0;
  }
  if (!canAccess) {
    return NextResponse.json(
      { status: "error", error: "Forbidden" },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  return {
    templateId,
    accountId,
    isFavourite: parsedBody.data.is_favourite,
  };
}
