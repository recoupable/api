import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

/**
 * Handler for issuing client-upload tokens for sandbox file staging.
 *
 * Vercel Blob client uploads are a two-phase handshake:
 *   1. Browser POSTs `HandleUploadBody` here (`type: "blob.generate-client-token"`)
 *      to get a presigned token. This phase carries the user's Bearer token in
 *      the `Authorization` header — `@vercel/blob/client.upload()` forwards
 *      headers from its `headers` option onto the handshake POST.
 *   2. Browser uploads directly to Vercel Blob, then Vercel Blob's backend
 *      POSTs back here (`type: "blob.upload-completed"`). This callback does
 *      not carry the user's auth header — instead, `handleUpload()` verifies
 *      the callback's signature against the token issued in phase 1.
 */
export async function postSandboxesUploadTokensHandler(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody;

    if (body.type === "blob.generate-client-token") {
      const auth = await validateAuthContext(request);
      if (auth instanceof NextResponse) {
        return auth;
      }
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        maximumSizeInBytes: MAX_UPLOAD_SIZE_BYTES,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse, { headers: getCorsHeaders() });
  } catch (error) {
    console.error("[postSandboxesUploadTokensHandler] handleUpload failed:", error);
    return NextResponse.json(
      { status: "error", error: "Failed to issue upload token" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
