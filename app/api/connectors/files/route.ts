import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { uploadConnectorFileHandler } from "@/lib/composio/connectors/uploadConnectorFileHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 200 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * POST /api/connectors/files
 *
 * Stages an image into Composio storage so it can be attached to a connector
 * action that accepts a `file_uploadable` field (e.g.
 * `LINKEDIN_CREATE_LINKED_IN_POST.images[]`, `TWITTER_CREATION_OF_A_POST`).
 * Requires `x-api-key` or `Authorization: Bearer`.
 *
 * @param request - The incoming request. JSON body: `url` (required — a
 *   publicly reachable image URL) and `toolSlug` (required — the
 *   UPPERCASE_SNAKE_CASE action slug the file will be attached to).
 * @returns A 200 NextResponse with `{ success, name, mimetype, s3key }`, 400 on
 *   missing/invalid body, 401 when unauthenticated, or 502 when Composio fails
 *   to fetch or store the image.
 */
export async function POST(request: NextRequest) {
  return uploadConnectorFileHandler(request);
}
