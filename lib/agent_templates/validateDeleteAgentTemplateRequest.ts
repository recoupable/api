import { NextRequest, NextResponse } from "next/server";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectAgentTemplate } from "@/lib/supabase/agent_templates/selectAgentTemplate";

export interface ValidatedDeleteAgentTemplateRequest {
  templateId: string;
  accountId: string;
}

/**
 * Validates DELETE /api/agent-templates/{id}: id format, auth, and that the
 * caller is the template's creator.
 *
 * @param request - The incoming request
 * @param id - The template id from the route
 * @returns Validated payload, or a NextResponse error.
 */
export async function validateDeleteAgentTemplateRequest(
  request: NextRequest,
  id: string,
): Promise<ValidatedDeleteAgentTemplateRequest | NextResponse> {
  const validatedParams = validateAccountParams(id);
  if (validatedParams instanceof NextResponse) return validatedParams;

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const templateId = validatedParams.id;
  const accountId = authResult.accountId;

  const existing = await selectAgentTemplate(templateId);
  if (!existing) {
    return NextResponse.json(
      { status: "error", error: "Agent template not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  if (existing.creator !== accountId) {
    return NextResponse.json(
      { status: "error", error: "Forbidden" },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  return { templateId, accountId };
}
