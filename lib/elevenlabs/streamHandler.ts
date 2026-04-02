import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateStreamBody } from "./validateStreamBody";
import { callElevenLabsMusic } from "./callElevenLabsMusic";

/**
 * Handler for POST /api/music/stream.
 * Generates a song and streams audio chunks directly to the client.
 * Does not buffer — pipes the upstream readable stream through.
 *
 * @param request - The incoming request with a JSON body.
 * @returns A streaming audio response or error JSON.
 */
export async function streamHandler(request: NextRequest): Promise<NextResponse | Response> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Request body must be valid JSON" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const validated = validateStreamBody(body);
  if (validated instanceof NextResponse) return validated;

  const { output_format, ...elevenLabsBody } = validated;

  try {
    const upstream = await callElevenLabsMusic("/v1/music/stream", elevenLabsBody, output_format);

    if (!upstream.ok) {
      const errorText = await upstream.text().catch(() => "Unknown error");
      console.error(`ElevenLabs stream returned ${upstream.status}: ${errorText}`);
      return NextResponse.json(
        { status: "error", error: `Music streaming failed (status ${upstream.status})` },
        { status: upstream.status >= 500 ? 502 : upstream.status, headers: getCorsHeaders() },
      );
    }

    const songId = upstream.headers.get("song-id");
    const contentType = upstream.headers.get("content-type") ?? "audio/mpeg";

    const headers: Record<string, string> = {
      ...getCorsHeaders(),
      "Content-Type": contentType,
      "Transfer-Encoding": "chunked",
    };
    if (songId) headers["song-id"] = songId;

    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error("ElevenLabs stream error:", error);
    return NextResponse.json(
      { status: "error", error: "Music streaming failed" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
