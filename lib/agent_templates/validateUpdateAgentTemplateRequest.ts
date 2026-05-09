import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { selectAgentTemplate } from "@/lib/supabase/agent_templates/selectAgentTemplate";

export const updateAgentTemplateBodySchema = z
  .object({
    title: z.string().min(3).max(50).optional(),
    description: z.string().min(10).max(200).optional(),
    prompt: z.string().min(20).max(10000).optional(),
    tags: z.array(z.string()).optional(),
    is_private: z.boolean().optional(),
    share_emails: z.array(z.string().email()).optional(),
  })
  .refine(data => Object.values(data).some(value => value !== undefined), {
    message: "At least one field to update must be provided",
  });

export type UpdateAgentTemplateBody = z.infer<typeof updateAgentTemplateBodySchema>;

export interface ValidatedUpdateAgentTemplateRequest {
  templateId: string;
  accountId: string;
  body: UpdateAgentTemplateBody;
}

/**
 * Validates PATCH /api/agent-templates/{id}: id format, body, auth, and that
 * the caller is the template's creator.
 *
 * @param request - The incoming request
 * @param id - The template id from the route
 * @returns Validated payload, or a NextResponse error.
 */
export async function validateUpdateAgentTemplateRequest(
  request: NextRequest,
  id: string,
): Promise<ValidatedUpdateAgentTemplateRequest | NextResponse> {
  const validatedParams = validateAccountParams(id);
  if (validatedParams instanceof NextResponse) return validatedParams;

  const body = await safeParseJson(request);
  const parsedBody = updateAgentTemplateBodySchema.safeParse(body);
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

  return { templateId, accountId, body: parsedBody.data };
}
