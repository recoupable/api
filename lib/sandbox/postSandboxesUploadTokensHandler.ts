import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

/**
 * Handler for issuing client-upload tokens for sandbox file staging.
 *
 * Vercel Blob client uploads are a two-step handshake:
 *   1. Browser POSTs `HandleUploadBody` here to get a presigned token.
 *   2. Browser uploads directly to Vercel Blob, then Blob calls back to this
 *      same URL with a completion event.
 *
 * The `@vercel/blob/client` library does not allow setting an `Authorization`
 * header on the handshake POST, so callers pass the Privy access token via
 * `clientPayload`. The token is validated by presence here; downstream commit
 * (POST /api/sandboxes/files) re-authenticates with a real Bearer token.
 */
export async function postSandboxesUploadTokensHandler(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const payload = clientPayload ? JSON.parse(clientPayload) : null;
        if (!payload?.token) {
          throw new Error("Authentication required");
        }

        return {
          maximumSizeInBytes: MAX_UPLOAD_SIZE_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse, { headers: getCorsHeaders() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400, headers: getCorsHeaders() },
    );
  }
}
