import { type NextRequest } from "next/server";
import { uploadFileHandler } from "@/lib/files/uploadFileHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Upload an authenticated, bounded multipart file to existing public media storage.
 *
 * @param request - Multipart request with one file field.
 * @returns The stored URL or a typed upload error response.
 */
export async function POST(request: NextRequest) {
  return uploadFileHandler(request);
}

/**
 * Browser preflight does not read a body or write storage.
 *
 * @returns An empty CORS response.
 */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
