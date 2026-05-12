import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import {
  validateCreateTemplateBody,
  type CreateTemplateBody,
} from "@/lib/templates/validateCreateTemplateBody";

export interface ValidatedCreateTemplateRequest {
  accountId: string;
  body: CreateTemplateBody;
}

/**
 * Validates POST /api/agents/templates: auth and JSON body. Mirrors the
 * one-call validate pattern used by the other template request validators.
 */
export async function validateCreateTemplateRequest(
  request: NextRequest,
): Promise<ValidatedCreateTemplateRequest | NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const rawBody = await safeParseJson(request);
  const parsedBody = validateCreateTemplateBody(rawBody);
  if (parsedBody instanceof NextResponse) return parsedBody;

  return { accountId: authResult.accountId, body: parsedBody };
}
