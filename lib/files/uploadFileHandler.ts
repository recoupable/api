import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { uploadPublicAsset } from "@/lib/files/uploadPublicAsset";
import { SUPPORTED_UPLOAD_MIME } from "@/lib/const";

/**
 * Handles POST /api/upload — uploads a file to the public-uploads Supabase
 * bucket and returns a permanent CDN URL.
 *
 * Mirrors the chat-side `/api/upload` response shape exactly so callers can
 * migrate with a base-URL swap. Requires authentication (x-api-key or
 * Authorization: Bearer); the caller's accountId is stamped onto the
 * storage object's metadata for later audit / takedown.
 *
 * @param request - The incoming request carrying multipart/form-data with a `file` field.
 * @returns A NextResponse with `{ success, fileName, fileType, fileSize, url }` on 200,
 *   `{ success: false, error }` on 400/401/415/500.
 */
export async function uploadFileHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    // Re-emit auth error in this endpoint's `{ success: false, error }` shape
    // rather than passing through validateAuthContext's `{ status, error }`.
    const payload = (await authResult.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    return errorResponse(authResult.status, payload?.error || payload?.message || "Unauthorized");
  }
  const { accountId } = authResult;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(400, "Invalid multipart body");
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return errorResponse(400, "No file provided");
  }

  // Reject octet-stream and any other type not in the allowlist. The bucket
  // itself enforces the same allowlist server-side, so an unknown type would
  // 500 there anyway — catching it here gives a clean 415 instead.
  const fileType = file.type;
  if (!fileType || !SUPPORTED_UPLOAD_MIME.has(fileType)) {
    return errorResponse(415, "Unsupported file type");
  }

  // Note: per-request size cap is enforced by the Vercel platform (returns
  // 413 FUNCTION_PAYLOAD_TOO_LARGE before the handler runs) and again by the
  // bucket's `file_size_limit` server-side. We don't duplicate it here.

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadPublicAsset({
      data: buffer,
      contentType: fileType,
      metadata: { uploaded_by: accountId },
    });

    return NextResponse.json(
      {
        success: true,
        fileName: file.name,
        fileType,
        fileSize: buffer.length,
        url,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("/api/upload error", error);
    return errorResponse(500, "Internal server error");
  }
}

function errorResponse(status: number, message: string): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status, headers: getCorsHeaders() },
  );
}
