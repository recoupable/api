import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Checks if an upstream ElevenLabs response failed and returns an error NextResponse.
 * Returns null if the response is OK (caller should continue processing).
 *
 * @param upstream - The raw Response from ElevenLabs.
 * @param context - Human-readable context for error messages (e.g. "Music generation").
 * @returns A NextResponse error, or null if the response is OK.
 */
export async function handleUpstreamError(
  upstream: Response,
  context: string,
): Promise<NextResponse | null> {
  if (upstream.ok) return null;

  const errorText = await upstream.text().catch(() => "Unknown error");
  console.error(`ElevenLabs ${context} returned ${upstream.status}: ${errorText}`);

  return NextResponse.json(
    { status: "error", error: `${context} failed (status ${upstream.status})` },
    { status: upstream.status >= 500 ? 502 : upstream.status, headers: getCorsHeaders() },
  );
}
