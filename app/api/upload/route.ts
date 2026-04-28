import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { uploadFileHandler } from "@/lib/arweave/uploadFileHandler";

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
 * POST /api/upload
 *
 * Uploads a file (multipart/form-data, field name `file`) to Arweave and
 * returns the gateway URL.
 *
 * @param request - The incoming request carrying the file.
 * @returns A NextResponse with `{ success, fileName, fileType, fileSize, url }` on 200
 *   or `{ success: false, error }` on 500.
 */
export async function POST(request: NextRequest) {
  return uploadFileHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
