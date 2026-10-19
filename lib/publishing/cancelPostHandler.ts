import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRun } from "workflow/api";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { selectScheduledPosts } from "@/lib/supabase/scheduled_posts/selectScheduledPosts";
import { updateScheduledPostIfStatus } from "@/lib/supabase/scheduled_posts/updateScheduledPostIfStatus";

const NOT_CANCELLABLE = "Only a scheduled post can be cancelled";

/**
 * DELETE /api/posts/{id}
 *
 * Cancels a post that is still `scheduled`. The status flip is conditional,
 * so a post whose run woke up and claimed it a moment earlier gets 409, not
 * a cancel that arrives too late. Stopping the sleeping run afterwards is
 * cleanup: if it fails, the run's claim step still finds the post cancelled.
 *
 * @param request - The incoming request.
 * @param id - Post id from the route segment.
 * @returns 200 `{ id, status: "cancelled" }`, 400 on a malformed id, 403
 *   without access, 404 when it does not exist, 409 when it is not scheduled,
 *   or 500.
 */
export async function cancelPostHandler(request: NextRequest, id: string): Promise<NextResponse> {
  if (!z.string().uuid().safeParse(id).success) {
    return errorResponse("id must be a valid UUID", 400);
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const [row] = await selectScheduledPosts({ id });
    if (!row) return errorResponse("Post not found", 404);

    const allowed = await canAccessAccount({
      currentAccountId: authResult.accountId,
      targetAccountId: row.account_id,
    });
    if (!allowed) return errorResponse("Access denied to this post's account", 403);

    if (row.status !== "scheduled") return errorResponse(NOT_CANCELLABLE, 409);

    const cancelled = await updateScheduledPostIfStatus(id, "scheduled", { status: "cancelled" });
    if (!cancelled) return errorResponse(NOT_CANCELLABLE, 409);

    if (row.workflow_run_id) {
      await getRun(row.workflow_run_id)
        .cancel()
        .catch(error => console.error(`[cancel-post] Could not stop run for ${id}:`, error));
    }

    return NextResponse.json(
      { id: cancelled.id, status: cancelled.status },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Error cancelling post:", error);
    return errorResponse("Internal server error", 500);
  }
}
