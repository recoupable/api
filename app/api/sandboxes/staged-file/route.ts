import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postSandboxesUploadTokensHandler } from "@/lib/sandbox/postSandboxesUploadTokensHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * POST /api/sandboxes/staged-file
 *
 * Issues presigned client-upload tokens for the Vercel Blob handshake used by
 * the sandbox file-staging flow. The browser POSTs the `HandleUploadBody`
 * here, uploads directly to Vercel Blob with the returned token, and then
 * passes the resulting blob URLs to `POST /api/sandboxes/files` which commits
 * them to the account's sandbox GitHub repo and cleans up the blobs.
 *
 * Authentication: x-api-key header or Authorization Bearer token, matching
 * other sandbox endpoints. `@vercel/blob/client.upload()` forwards the
 * caller's headers onto the handshake POST. The upload-completed callback
 * from Vercel Blob's backend does not carry the user's auth header — its
 * signature is verified internally by `handleUpload()` against the token
 * issued during the handshake.
 *
 * Request body: `HandleUploadBody` (from `@vercel/blob/client`).
 *
 * Response (200): the JSON envelope from `handleUpload()` (either a generated
 * client token or an upload-completed acknowledgement).
 *
 * Error (401): missing or invalid auth on the handshake POST.
 * Error (500): invalid body or upstream Vercel Blob failure.
 *
 * @param request - The request object
 * @returns A NextResponse with the handshake result or error
 */
export async function POST(request: NextRequest): Promise<Response> {
  return postSandboxesUploadTokensHandler(request);
}
