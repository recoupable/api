import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

// Auth applies only to the handshake — the upload-completed callback is signature-verified by handleUpload().
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
