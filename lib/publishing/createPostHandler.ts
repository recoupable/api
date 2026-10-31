import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateCreatePostBody } from "@/lib/publishing/validateCreatePostBody";
import { findConnectedAccountId } from "@/lib/publishing/findConnectedAccountId";
import { ensurePostCredits } from "@/lib/publishing/ensurePostCredits";
import { validatePostAccounts } from "@/lib/publishing/validatePostAccounts";
import { startPost } from "@/lib/publishing/startPost";

/**
 * POST /api/posts
 *
 * Starts publishing one video to one connected account and returns
 * immediately: uploads and platform processing take minutes, so this answers
 * 202 with the post's id and `publishing` status for the client to poll.
 *
 * @param request - Incoming request with the post.
 * @returns 202 `{ id, status }` with a Location header, or the validation,
 *   auth, connection or credit failure that stopped it.
 */
export async function createPostHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateCreatePostBody(request);
  if (validated instanceof NextResponse) return validated;

  try {
    const invalidAccounts = await validatePostAccounts(validated);
    if (invalidAccounts) return invalidAccounts;

    const connectedAccountId = await findConnectedAccountId(
      validated.artist_account_id ?? validated.accountId,
      validated.platform,
    );
    if (!connectedAccountId) {
      return errorResponse(
        `${validated.platform} is not connected for this account. Authorize it with POST /api/connectors first.`,
        409,
      );
    }

    const short = await ensurePostCredits(validated.accountId);
    if (short) return short;

    const row = await startPost(validated);

    return NextResponse.json(
      { id: row.id, status: row.status },
      { status: 202, headers: { ...getCorsHeaders(), Location: `/api/posts/${row.id}` } },
    );
  } catch (error) {
    console.error("Post start error:", error);
    return errorResponse("Internal server error", 500);
  }
}
