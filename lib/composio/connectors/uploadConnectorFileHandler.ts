import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateUploadConnectorFileRequest } from "./validateUploadConnectorFileRequest";
import { uploadConnectorFile } from "./uploadConnectorFile";

/**
 * Handler for POST /api/connectors/files.
 *
 * Stages an image (by public URL) into Composio storage and returns a flat
 * `{ success, name, mimetype, s3key }` descriptor. The caller passes
 * `{ name, mimetype, s3key }` into a `file_uploadable` action parameter
 * (e.g. `parameters.images[]` for `LINKEDIN_CREATE_LINKED_IN_POST`) on
 * POST /api/connectors/actions. A failure to fetch or store the image surfaces
 * as 502 (upstream).
 *
 * @param request - The incoming request
 * @returns A 200 response with `{ success, name, mimetype, s3key }`, or an error.
 */
export async function uploadConnectorFileHandler(request: NextRequest): Promise<NextResponse> {
  const headers = getCorsHeaders();

  try {
    const validated = await validateUploadConnectorFileRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { name, mimetype, s3key } = await uploadConnectorFile(validated);

    return NextResponse.json({ success: true, name, mimetype, s3key }, { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload connector file";
    console.error("Connector file upload error:", error);
    return NextResponse.json({ error: message }, { status: 502, headers });
  }
}
