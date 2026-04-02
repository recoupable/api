import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateStemSeparationBody } from "./validateStemSeparationBody";
import { callElevenLabsMusicMultipart } from "./callElevenLabsMusicMultipart";
import { handleUpstreamError } from "./handleUpstreamError";
import { buildUpstreamResponse } from "./buildUpstreamResponse";

/**
 * Handler for POST /api/music/stem-separation.
 * Accepts multipart/form-data with an audio file.
 * Separates the audio into individual stems (vocals, drums, bass, etc.).
 * Returns a ZIP archive containing the stem files.
 *
 * @param request - The incoming multipart/form-data request.
 * @returns ZIP archive response or error JSON.
 */
export async function stemSeparationHandler(
  request: NextRequest,
): Promise<NextResponse | Response> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  let incomingForm: FormData;
  try {
    incomingForm = await request.formData();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Request must be multipart/form-data" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const file = incomingForm.get("file") as File | null;
  if (!file) {
    return NextResponse.json(
      { status: "error", error: "An audio file is required in the 'file' field" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const textFields: Record<string, unknown> = {};
  for (const [key, value] of incomingForm.entries()) {
    if (key !== "file" && typeof value === "string") {
      if (key === "sign_with_c2pa") {
        textFields[key] = value === "true";
      } else {
        textFields[key] = value;
      }
    }
  }

  const validated = validateStemSeparationBody(textFields);
  if (validated instanceof NextResponse) return validated;

  const upstreamForm = new FormData();
  upstreamForm.append("file", file);
  upstreamForm.append("stem_variation_id", validated.stem_variation_id);
  if (validated.sign_with_c2pa) {
    upstreamForm.append("sign_with_c2pa", String(validated.sign_with_c2pa));
  }

  try {
    const upstream = await callElevenLabsMusicMultipart(
      "/v1/music/stem-separation",
      upstreamForm,
      validated.output_format,
    );

    const errorResponse = await handleUpstreamError(upstream, "Stem separation");
    if (errorResponse) return errorResponse;

    return buildUpstreamResponse(upstream, "application/zip", ["content-disposition"]);
  } catch (error) {
    console.error("ElevenLabs stem-separation error:", error);
    return NextResponse.json(
      { status: "error", error: "Stem separation failed" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
