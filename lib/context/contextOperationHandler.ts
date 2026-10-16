import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { processContextOperation } from "./processContextOperation";
import { validateContextOperationBody } from "./validateContextOperationBody";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { dispatchContextRequest } from "./dispatchContextRequest";
import { dispatchContextReleaseVerification } from "./dispatchContextReleaseVerification";
import { dispatchContextReleaseTrackIsrcs } from "./dispatchContextReleaseTrackIsrcs";
import { classifyContextOperationError } from "./classifyContextOperationError";
import { formatContextOperationError } from "./formatContextOperationError";
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
      dispatchRelease: dispatchContextReleaseVerification,
      dispatchReleaseTracks: dispatchContextReleaseTrackIsrcs,
    });
    return NextResponse.json(result, {
      status: ["ingest", "verify_release", "verify_release_tracks"].includes(parsed.action)
        ? 202
        : 200,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    const { status, body } = formatContextOperationError(classifyContextOperationError(error));
    return NextResponse.json(body, { status, headers: getCorsHeaders() });
  }
}
