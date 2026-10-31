import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateGetCommentsQuery } from "./validateGetCommentsQuery";
import { canReadCreatorComments } from "./canReadCreatorComments";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { selectAccountSocialIds } from "@/lib/supabase/account_socials/selectAccountSocialIds";
import { selectStoredPostComments } from "@/lib/supabase/post_comments/selectStoredPostComments";

/** Read existing comments on posts linked to a creator the authenticated account can access. */
export async function getCommentsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await validateAuthContext(request);
    if (auth instanceof NextResponse) return auth;
    const params = validateGetCommentsQuery(new URL(request.url).searchParams);
    if (params instanceof NextResponse) return params;
    if (!(await canReadCreatorComments(auth.accountId, params.artist_account_id))) {
      return errorResponse("Unauthorized", 403);
    }
    const [creator] = await selectAccounts(params.artist_account_id);
    if (!creator) return errorResponse("Unauthorized", 403);
    const socialIds = await selectAccountSocialIds(params.artist_account_id);
    const { comments, totalCount } = await selectStoredPostComments({
      socialIds,
      postId: params.post_id,
      page: params.page,
      limit: params.limit,
    });
    return NextResponse.json(
      {
        status: "success",
        comments,
        pagination: {
          total_count: totalCount,
          page: params.page,
          limit: params.limit,
          total_pages: Math.ceil(totalCount / params.limit),
        },
      },
      { headers: getCorsHeaders() },
    );
  } catch {
    return errorResponse("Internal server error", 500);
  }
}
