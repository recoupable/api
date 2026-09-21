import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { processContextOperation } from "./processContextOperation";
import { validateContextOperationBody } from "./validateContextOperationBody";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { dispatchContextRequest } from "./dispatchContextRequest";
/** POST /api/context: authenticated ingestion, progress, and task-specific context selection. */
export async function contextOperationHandler(request: NextRequest) {
  const parsed = validateContextOperationBody(await request.json().catch(() => null));
  if (parsed instanceof NextResponse) return parsed;
  const auth = await validateAuthContext(request, { organizationId: parsed.organization_id });
  if (auth instanceof NextResponse) return auth;
  try {
    const result = await processContextOperation(auth.accountId, parsed, {
      rpc: callContextRpc,
      dispatch: dispatchContextRequest,
    });
    return NextResponse.json(result, {
      status: parsed.action === "ingest" ? 202 : 200,
      headers: getCorsHeaders(),
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Context operation could not complete. Check scope, request ID and provider availability; retry ingestion with the same idempotency key.",
      },
      { status: 409, headers: getCorsHeaders() },
    );
  }
}
