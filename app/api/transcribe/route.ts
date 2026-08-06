import { NextRequest, NextResponse } from "next/server";
import { transcribeHandler } from "@/lib/transcribe/transcribeHandler";

/**
 * POST /api/transcribe
 *
 * Transcribes a hosted audio file into text and persists both the audio and the
 * transcript as files against the authenticated account and the artist account.
 * Unlike `/api/content/transcribe`, this endpoint writes the results to storage
 * and returns file references in addition to the raw text.
 *
 * Requires authentication via x-api-key header or Authorization bearer token.
 * The owner account is derived from those credentials; the caller must have
 * access to `artist_account_id`.
 *
 * Body parameters:
 * - audio_url (required): URL of the hosted audio file
 * - artist_account_id (required): The artist's account ID (UUID)
 * - title (optional): Title for the stored transcript
 * - include_timestamps (optional): Whether to include timestamps in the text
 *
 * Response:
 * - 200: { success, audioFile, transcriptFile, text, language }
 * - 400: Invalid parameters
 * - 401: Missing or invalid credentials
 * - 403: Caller has no access to the specified artist_account_id
 *
 * @param request - The request object containing the body
 * @returns A NextResponse with the transcription result, or an error.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return transcribeHandler(request);
}
