import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { uploadToArweave } from "@/lib/arweave/uploadToArweave";
import { getFetchableUrl } from "@/lib/arweave/getFetchableUrl";

/**
 * Handles POST /api/upload — uploads a file to Arweave and returns a gateway URL.
 *
 * Mirrors the chat-side response shape exactly so callers can migrate
 * with a single base-URL swap.
 *
 * @param request - The incoming request carrying multipart/form-data with a `file` field.
 * @returns A NextResponse with `{ success, fileName, fileType, fileSize, url }` on 200
 *   or `{ success: false, error }` on 500.
 */
export async function uploadFileHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      throw new Error("No file provided");
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileSize = fileBuffer.length;
    const fileType = file.type || "application/octet-stream";
    const fileName = file.name;

    const transaction = await uploadToArweave(fileBuffer, fileType);

    return NextResponse.json(
      {
        success: true,
        fileName,
        fileType,
        fileSize,
        url: getFetchableUrl(`ar://${transaction.id}`),
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("/api/upload error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
