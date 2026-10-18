import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createPostHandler } from "@/lib/publishing/createPostHandler";
import { getPostsHandler } from "@/lib/publishing/getPostsHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/posts
 *
 * Publishes a video with its copy to one connected social account (contract:
 * recoupable/docs#375, tracking recoupable/app#2241). Publish-now only for
 * now; `publish_at` is rejected until scheduling ships.
 *
 * @param request - JSON body `{ platform, video_url, cover_url?, title?,
 *   description?, privacy?, tags?, sub_account_id?, account_id? }`.
 * @returns 202 `{ id, status }` with a Location header, 400 on a bad body, 401
 *   unauthenticated, 403 on a denied override, 409 when the platform is not
 *   connected, or 500.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createPostHandler(request);
}

/**
 * GET /api/posts
 *
 * The account's posts, newest first.
 *
 * @param request - Query params `account_id?`, `status?`, `platform?`,
 *   `limit?`, `offset?`.
 * @returns 200 with the posts, 400 on a bad query, 401 unauthenticated, 403 on
 *   a denied override, or 500.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getPostsHandler(request);
}

export const dynamic = "force-dynamic";
