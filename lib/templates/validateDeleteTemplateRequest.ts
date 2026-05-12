import { NextRequest, NextResponse } from "next/server";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectTemplates } from "@/lib/supabase/templates/selectTemplates";

export interface ValidatedDeleteTemplateRequest {
  templateId: string;
  accountId: string;
}

/**
 * Validates DELETE /api/templates/{id}: auth, id format, and that the
 * caller is the template's creator.
 */
export async function validateDeleteTemplateRequest(
  request: NextRequest,
  id: string,
): Promise<ValidatedDeleteTemplateRequest | NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const validatedParams = validateAccountParams(id);
  if (validatedParams instanceof NextResponse) return validatedParams;

  const templateId = validatedParams.id;
  const accountId = authResult.accountId;

  const [existing] = await selectTemplates({ id: templateId });
  if (!existing) {
    return NextResponse.json(
      { status: "error", error: "Template not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  if (existing.creator?.id !== accountId) {
    return NextResponse.json(
      { status: "error", error: "Forbidden" },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  return { templateId, accountId };
}
