import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { uploadPublicAsset } from "@/lib/files/uploadPublicAsset";
import { SUPPORTED_UPLOAD_MIME } from "@/lib/const";

/**
 * Handles POST /api/upload — uploads a file to the public-uploads Supabase
 * bucket and returns a permanent CDN URL.
 *
 * Mirrors the chat-side `/api/upload` response shape exactly so callers can
 * migrate with a base-URL swap. Phase-1 of the arweave→supabase migration:
 * no auth, public bucket, opaque-UUID keys.
 *
 * @param request - The incoming request carrying multipart/form-data with a `file` field.
 * @returns A NextResponse with `{ success, fileName, fileType, fileSize, url }` on 200,
 *   `{ success: false, error }` on 400/500.
 */
export async function uploadFileHandler(request: NextRequest): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    return errorResponse(400, error instanceof Error ? error.message : "Invalid multipart body");
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return errorResponse(400, "No file provided");
  }

  // Note: per-request size cap is enforced by the Vercel platform (returns
  // 413 FUNCTION_PAYLOAD_TOO_LARGE before the handler runs) and again by the
  // bucket's `file_size_limit` server-side. We don't duplicate it here.

  const fileType = file.type || "application/octet-stream";
  const isOctet = fileType === "application/octet-stream";

  // Allow application/octet-stream as a fallback when the client did not
  // declare a content type — matches the chat-side handler's behavior.
  if (!isOctet && !SUPPORTED_UPLOAD_MIME.has(fileType)) {
    return errorResponse(400, "Unsupported file type");
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadPublicAsset({
      data: buffer,
      contentType: fileType,
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
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}

function errorResponse(status: number, message: string): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status, headers: getCorsHeaders() },
  );
}
