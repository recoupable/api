import { NextRequest, NextResponse } from "next/server";
import { validateEvidenceManifestQuery } from "./validateEvidenceManifestQuery";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { processContextOperation } from "./processContextOperation";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/** Conventional HTTP retrieval with the same scoped domain operation as standard MCP. */
export async function getEvidenceManifestHandler(request: NextRequest) {
  const parsed = validateEvidenceManifestQuery(request.nextUrl.searchParams);
  if (parsed instanceof NextResponse) return parsed;
  const auth = await validateAuthContext(request, { organizationId: parsed.organization_id });
  if (auth instanceof NextResponse) {
    auth.headers.set("Cache-Control", "private, no-store");
    return auth;
  }
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  try {
    const result = await processContextOperation(
      auth.accountId,
      { ...parsed, action: "list_evidence_versions" },
      {
        rpc: callContextRpc,
        dispatch: async () => {
          throw new Error("Evidence discovery cannot dispatch collection");
        },
      },
    );
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json(
      { error: "Evidence manifest unavailable. Check workspace, request and cursor access." },
      { status: 409, headers },
    );
  }
}
