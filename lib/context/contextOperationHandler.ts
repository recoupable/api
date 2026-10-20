import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { processContextOperation } from "./processContextOperation";
import { validateContextOperationBody } from "./validateContextOperationBody";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { dispatchContextRequest } from "./dispatchContextRequest";
import { dispatchContextReleaseVerification } from "./dispatchContextReleaseVerification";
import { dispatchContextReleaseTrackIsrcs } from "./dispatchContextReleaseTrackIsrcs";
/** POST /api/context: authenticated ingestion, progress, and task-specific context selection. */
export async function contextOperationHandler(request: NextRequest) {
  const parsed = validateContextOperationBody(await request.json().catch(() => null));
  if (parsed instanceof NextResponse) return parsed;
  const auth = await validateAuthContext(request, { organizationId: parsed.organization_id });
  if (auth instanceof NextResponse) return auth;
  const headers = {
    ...getCorsHeaders(),
    ...(parsed.action === "read" ? { "Cache-Control": "private, no-store" } : {}),
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
      const reason =
        error instanceof Error && error.message === "Material evidence could not be verified"
          ? "material_evidence_unverified"
          : error instanceof Error && error.message === "Material evidence owner changed"
            ? "owner_changed"
            : "dependency_or_access";
      console.error("[context] read failed", { reason });
    }
    return NextResponse.json(
      {
        error:
          "Context operation could not complete. Check scope, request ID and provider availability; retry ingestion with the same idempotency key.",
      },
      { status: 409, headers },
    );
  }
}
