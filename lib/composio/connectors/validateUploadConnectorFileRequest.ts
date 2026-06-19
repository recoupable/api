import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateUploadConnectorFileBody } from "./validateUploadConnectorFileBody";

/**
 * Validated params for staging a connector file.
 */
export interface UploadConnectorFileParams {
  url: string;
  toolSlug: string;
}

/**
 * Validates the full POST /api/connectors/files request.
 *
 * Handles:
 * 1. Authentication (x-api-key or Bearer token) — gates the endpoint
 * 2. Body validation ({ url, toolSlug })
 *
 * The Composio upload is scoped by tool/toolkit, not by connected account, so
 * no `account_id` is accepted or used here — authentication just gates access.
 *
 * @param request - The incoming request
 * @returns NextResponse error or validated params
 */
export async function validateUploadConnectorFileRequest(
  request: NextRequest,
): Promise<NextResponse | UploadConnectorFileParams> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const body = await request.json();
  const validated = validateUploadConnectorFileBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }

  return { url: validated.url, toolSlug: validated.toolSlug };
}
