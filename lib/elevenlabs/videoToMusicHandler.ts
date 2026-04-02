import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateVideoToMusicBody } from "./validateVideoToMusicBody";
import { callElevenLabsMusicMultipart } from "./callElevenLabsMusicMultipart";
import { handleUpstreamError } from "./handleUpstreamError";
import { buildUpstreamResponse } from "./buildUpstreamResponse";

const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200MB
const MAX_FILES = 10;

/**
 * Handler for POST /api/music/video-to-music.
 * Accepts multipart/form-data with video files and text fields.
 * Generates background music from the video content.
 *
 * @param request - The incoming multipart/form-data request.
 * @returns Binary audio response or error JSON.
 */
export async function videoToMusicHandler(request: NextRequest): Promise<NextResponse | Response> {
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

  const videos = incomingForm.getAll("videos") as File[];
  if (videos.length === 0) {
    return NextResponse.json(
      { status: "error", error: "At least one video file is required in the 'videos' field" },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  if (videos.length > MAX_FILES) {
    return NextResponse.json(
      { status: "error", error: `Maximum ${MAX_FILES} video files allowed` },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const totalSize = videos.reduce((sum, v) => sum + v.size, 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    return NextResponse.json(
      { status: "error", error: "Total video size exceeds 200MB limit" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const textFields: Record<string, unknown> = {};
  for (const [key, value] of incomingForm.entries()) {
    if (key !== "videos" && typeof value === "string") {
      if (key === "tags") {
        textFields[key] = value.split(",").map((t) => t.trim());
      } else if (key === "sign_with_c2pa") {
        textFields[key] = value === "true";
      } else {
        textFields[key] = value;
      }
    }
  }

  const validated = validateVideoToMusicBody(textFields);
  if (validated instanceof NextResponse) return validated;

  const upstreamForm = new FormData();
  for (const video of videos) {
    upstreamForm.append("videos", video);
  }
  if (validated.description) upstreamForm.append("description", validated.description);
  if (validated.tags) {
    for (const tag of validated.tags) {
      upstreamForm.append("tags", tag);
    }
  }
  if (validated.sign_with_c2pa) {
    upstreamForm.append("sign_with_c2pa", String(validated.sign_with_c2pa));
  }

  try {
    const upstream = await callElevenLabsMusicMultipart(
      "/v1/music/video-to-music",
      upstreamForm,
      validated.output_format,
    );

    const errorResponse = await handleUpstreamError(upstream, "Video-to-music");
    if (errorResponse) return errorResponse;

    return buildUpstreamResponse(upstream, "audio/mpeg");
  } catch (error) {
    console.error("ElevenLabs video-to-music error:", error);
    return NextResponse.json(
      { status: "error", error: "Video-to-music generation failed" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
