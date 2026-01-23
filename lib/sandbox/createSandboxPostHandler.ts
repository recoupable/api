import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { createSandbox } from "@/lib/sandbox/createSandbox";

/**
 * Handler for POST /api/sandbox.
 *
 * Creates a new ephemeral sandbox environment. Requires authentication via x-api-key header.
 * No request body is required.
 *
 * @param request - The request object
 * @returns A NextResponse with sandbox data or error
 */
export async function createSandboxPostHandler(request: NextRequest): Promise<NextResponse> {
  const accountIdOrError = await getApiKeyAccountId(request);
  if (accountIdOrError instanceof NextResponse) {
    return accountIdOrError;
  }

  try {
    const sandbox = await createSandbox();

    return NextResponse.json(sandbox, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create sandbox";
    return NextResponse.json({ error: message }, { status: 400, headers: getCorsHeaders() });
  }
}
