import { NextRequest, NextResponse } from "next/server";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectAgentTemplates } from "@/lib/supabase/agent_templates/selectAgentTemplates";

export interface ValidatedDeleteAgentTemplateRequest {
  templateId: string;
  accountId: string;
}

/**
 * Validates DELETE /api/agent-templates/{id}: auth, id format, and that the
 * caller is the template's creator.
 */
export async function validateDeleteAgentTemplateRequest(
  request: NextRequest,
  id: string,
): Promise<ValidatedDeleteAgentTemplateRequest | NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const validatedParams = validateAccountParams(id);
  if (validatedParams instanceof NextResponse) return validatedParams;

  const templateId = validatedParams.id;
  const accountId = authResult.accountId;

  const [existing] = await selectAgentTemplates({ id: templateId });
  if (!existing) {
    return NextResponse.json(
      { status: "error", error: "Agent template not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  const creator = Array.isArray(existing.creator) ? existing.creator[0] : existing.creator;
  if (creator?.id !== accountId) {
    return NextResponse.json(
      { status: "error", error: "Forbidden" },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  return { templateId, accountId };
}
