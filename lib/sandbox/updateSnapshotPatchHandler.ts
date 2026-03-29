import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateSnapshotPatchBody } from "@/lib/sandbox/validateSnapshotPatchBody";
import { upsertAccountSnapshot } from "@/lib/supabase/account_snapshots/upsertAccountSnapshot";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";

/**
 * Handler for PATCH /api/sandboxes.
 *
 * Updates the github_repo for an account's sandbox metadata.
 * Requires authentication via x-api-key header or Authorization Bearer token.
 *
 * @param request - The request object
 * @returns A NextResponse with the updated account snapshot row or error
 */
export async function updateSnapshotPatchHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateSnapshotPatchBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  if (!validated.githubRepo) {
    const rows = await selectAccountSnapshots(validated.accountId);
    return NextResponse.json(rows[0] ?? null, { status: 200, headers: getCorsHeaders() });
  }

  try {
    const result = await upsertAccountSnapshot({
      account_id: validated.accountId,
      github_repo: validated.githubRepo,
    });

    if (result.error || !result.data) {
      return NextResponse.json(
        { status: "error", error: "Failed to update sandbox metadata" },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(result.data, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update sandbox metadata";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 400, headers: getCorsHeaders() },
    );
  }
}
