import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { processContextOperation } from "./processContextOperation";
import { validateContextOperationBody } from "./validateContextOperationBody";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { dispatchContextRequest } from "./dispatchContextRequest";
import { dispatchContextReleaseVerification } from "./dispatchContextReleaseVerification";
import { dispatchContextReleaseTrackIsrcs } from "./dispatchContextReleaseTrackIsrcs";
import { getContextFailureReason } from "./getContextFailureReason";
import { getContextFailureMessage } from "./getContextFailureMessage";
/** POST /api/context: authenticated ingestion, progress, and task-specific context selection. */
export async function contextOperationHandler(request: NextRequest) {
  const parsed = validateContextOperationBody(await request.json().catch(() => null));
  if (parsed instanceof NextResponse) return parsed;
  const auth = await validateAuthContext(request, { organizationId: parsed.organization_id });
  if (auth instanceof NextResponse) return auth;
  const evidence = [
    "attach_evidence",
    "read_evidence_attachment",
    "list_evidence_attachments",
  ].includes(parsed.action);
  const catalogCase = ["save_catalog_case", "read_catalog_case", "list_catalog_cases"].includes(
    parsed.action,
  );
  const headers = {
    ...getCorsHeaders(),
    ...(parsed.action === "read" || evidence || catalogCase
      ? { "Cache-Control": "private, no-store" }
      : {}),
  };
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
      headers,
    });
  } catch (error) {
    if (parsed.action === "read") {
      console.error("[context] read failed", { reason: getContextFailureReason(error) });
    } else if (evidence || catalogCase) {
      console.error("[context] evidence operation failed", {
        reason: getContextFailureReason(error),
      });
    }
    return NextResponse.json(
      {
        error: getContextFailureMessage(parsed.action),
      },
      { status: 409, headers },
    );
  }
}
