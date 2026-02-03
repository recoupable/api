import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateSnapshotPatchBody } from "@/lib/sandbox/validateSnapshotPatchBody";
import { upsertAccountSnapshot } from "@/lib/supabase/account_snapshots/upsertAccountSnapshot";

/**
 * Handler for PATCH /api/sandboxes/snapshot.
 *
 * Updates the snapshot ID for an account. This snapshot will be used
 * as the base environment when creating new sandboxes.
 * Requires authentication via x-api-key header or Authorization Bearer token.
 *
 * @param request - The request object
 * @returns A NextResponse with the updated snapshot ID or error
 */
export async function updateSnapshotPatchHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateSnapshotPatchBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const result = await upsertAccountSnapshot({
      accountId: validated.accountId,
      snapshotId: validated.snapshotId,
    });

    if (result.error || !result.data) {
      return NextResponse.json(
        { status: "error", error: "Failed to update snapshot" },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      {
        success: true,
        snapshotId: result.data.snapshot_id,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update snapshot";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 400, headers: getCorsHeaders() },
    );
  }
}
