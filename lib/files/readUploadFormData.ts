import { NextResponse, type NextRequest } from "next/server";
import { MAX_UPLOAD_BODY_BYTES } from "./uploadLimits";
import { uploadErrorResponse } from "./uploadErrorResponse";

/** Bound the actual stream before multipart parsing, even without Content-Length. */
export async function readUploadFormData(request: NextRequest): Promise<FormData | NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !request.body)
    return uploadErrorResponse(400, "Invalid multipart body");
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_UPLOAD_BODY_BYTES) return uploadErrorResponse(413, "Upload exceeds 4 MiB");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_UPLOAD_BODY_BYTES) {
        await reader.cancel();
        return uploadErrorResponse(413, "Upload exceeds 4 MiB");
      }
      chunks.push(value);
    }
    return await new Response(Buffer.concat(chunks), {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    return uploadErrorResponse(400, "Invalid multipart body");
  } finally {
    reader.releaseLock();
  }
}
