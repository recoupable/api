import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateExecuteConnectorActionRequest } from "./validateExecuteConnectorActionRequest";
import { executeConnectorAction, ConnectorActionNotFoundError } from "./executeConnectorAction";

/**
 * Handler for POST /api/connectors/actions.
 *
 * Executes a single connector action with the given parameters. The connector
 * validates the parameters against the action's cached schema and the toolkit's
 * connection state before invoking; granular failure modes (not connected,
 * invalid params, upstream error) currently surface as 500 with the underlying
 * error message — only the slug-not-found case is split out as 404.
 *
 * @param request - The incoming request
 * @returns A 200 response with `{ success, result, executedAt }`, or an error.
 */
export async function executeConnectorActionHandler(request: NextRequest): Promise<NextResponse> {
  const headers = getCorsHeaders();

  try {
    const validated = await validateExecuteConnectorActionRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { accountId, actionSlug, parameters } = validated;
    const { result, executedAt } = await executeConnectorAction(accountId, actionSlug, parameters);

    return NextResponse.json(
      {
        success: true,
        result,
        executedAt,
      },
      { status: 200, headers },
    );
  } catch (error) {
    if (error instanceof ConnectorActionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404, headers });
    }
    const message = error instanceof Error ? error.message : "Failed to execute connector action";
    console.error("Connector action execute error:", error);
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}
