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
 * Authentication: pass the caller's Privy access token in
 * `clientPayload` as `JSON.stringify({ token })`. `@vercel/blob/client.upload()`
 * does not allow setting arbitrary `Authorization` headers on the handshake
 * POST, so token transport rides on `clientPayload` rather than `Authorization`.
 *
 * Request body: `HandleUploadBody` (from `@vercel/blob/client`).
 *
 * Response (200): the JSON envelope from `handleUpload()` (either a generated
 * client token or an upload-completed acknowledgement).
 *
 * Error (400):
 * - error: string
 *
 * @param request - The request object
 * @returns A NextResponse with the handshake result or error
 */
export async function POST(request: Request): Promise<Response> {
  return postSandboxesUploadTokensHandler(request);
}
