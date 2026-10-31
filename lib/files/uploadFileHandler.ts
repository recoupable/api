import { NextResponse, type NextRequest } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { readUploadFormData } from "./readUploadFormData";
import { validateUploadFileBody } from "./validateUploadFileBody";
import { validatePublicUploadBytes } from "./validatePublicUploadBytes";
import { uploadPublicAsset } from "./uploadPublicAsset";
import { uploadErrorResponse } from "./uploadErrorResponse";

/** Authenticate before reading bounded multipart input; upload existing public media only. */
export async function uploadFileHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await validateAuthContext(request, { allowAccountCreation: false });
    if (auth instanceof NextResponse) {
      const body = await auth.json().catch(() => null);
      return uploadErrorResponse(auth.status, body?.error || body?.message || "Unauthorized");
    }
    const form = await readUploadFormData(request);
    if (form instanceof NextResponse) return form;
    const file = validateUploadFileBody(form);
    if (file instanceof NextResponse) return file;
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!validatePublicUploadBytes(bytes, file.type))
      return uploadErrorResponse(415, "File content does not match its type");
    const { url } = await uploadPublicAsset({
      data: bytes,
      contentType: file.type,
      uploaderAccountId: auth.accountId,
    });
    return NextResponse.json(
      { success: true, fileName: file.name, fileType: file.type, fileSize: bytes.length, url },
      { headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Public upload failed:", error);
    return uploadErrorResponse(500, "Could not upload file");
  }
}
