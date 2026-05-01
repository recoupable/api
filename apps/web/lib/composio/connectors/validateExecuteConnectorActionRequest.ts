import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateExecuteConnectorActionBody } from "./validateExecuteConnectorActionBody";
import { checkAccountAccess } from "@/lib/auth/checkAccountAccess";

/**
 * Validated params for executing a connector action.
 */
export interface ExecuteConnectorActionParams {
  accountId: string;
  actionSlug: string;
  parameters: Record<string, unknown>;
}

/**
 * Validates the full POST /api/connectors/actions request.
 *
 * Handles:
 * 1. Authentication (x-api-key or Bearer token)
 * 2. Body validation (actionSlug, parameters, optional account_id)
 * 3. Access verification (when account_id is provided)
 *
 * @param request - The incoming request
 * @returns NextResponse error or validated params
 */
export async function validateExecuteConnectorActionRequest(
  request: NextRequest,
): Promise<NextResponse | ExecuteConnectorActionParams> {
  const headers = getCorsHeaders();

  // 1. Validate authentication (supports x-api-key and Bearer token)
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { accountId } = authResult;

  // 2. Validate body structure
  const body = await request.json();
  const validated = validateExecuteConnectorActionBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { actionSlug, parameters, account_id } = validated;

  // 3. If account_id is provided, verify access and use that entity
  if (account_id) {
    const accessResult = await checkAccountAccess(accountId, account_id);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: "Access denied to this account" },
        { status: 403, headers },
      );
    }

    return { accountId: account_id, actionSlug, parameters };
  }

  // No account_id: use the authenticated account
  return { accountId, actionSlug, parameters };
}
