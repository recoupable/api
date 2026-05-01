import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetConnectorActionsRequest } from "./validateGetConnectorActionsRequest";
import { getConnectorActions } from "./getConnectorActions";

/**
 * Handler for GET /api/connectors/actions.
 *
 * Lists all executable connector actions for the authenticated account (or for
 * a different account when `account_id` is provided + caller has access).
 *
 * @param request - The incoming request
 * @returns A 200 response with `{ success, actions }`, or a validation error.
 */
export async function getConnectorActionsHandler(request: NextRequest): Promise<NextResponse> {
  const headers = getCorsHeaders();

  try {
    const validated = await validateGetConnectorActionsRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { accountId } = validated;
    const actions = await getConnectorActions(accountId);

    return NextResponse.json(
      {
        success: true,
        actions,
      },
      { status: 200, headers },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch connector actions";
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}
