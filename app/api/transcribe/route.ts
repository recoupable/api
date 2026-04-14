import { NextRequest, NextResponse } from "next/server";
import { processAudioTranscription } from "@/lib/transcribe/processAudioTranscription";
import { formatTranscriptionError } from "@/lib/transcribe/types";

/**
 * POST /api/transcribe
 *
 * Transcribes a hosted audio file into text and persists both the audio and the
 * transcript as files against the owner account and artist account. Unlike
 * `/api/content/transcribe`, this endpoint writes the results to storage and
 * returns file references in addition to the raw text.
 *
 * @param req - The incoming request with JSON body `{ audio_url, account_id,
 *   artist_account_id, title?, include_timestamps? }`. All three ids are required.
 * @returns A 200 NextResponse with `{ success, audioFile, transcriptFile, text,
 *   language }`, 400 when a required field is missing, or the status/message
 *   produced by `formatTranscriptionError` on downstream failures.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { audio_url, account_id, artist_account_id, title, include_timestamps } = body;

    if (!audio_url) {
      return NextResponse.json({ error: "Missing required field: audio_url" }, { status: 400 });
    }
    if (!account_id) {
      return NextResponse.json({ error: "Missing required field: account_id" }, { status: 400 });
    }
    if (!artist_account_id) {
      return NextResponse.json(
        { error: "Missing required field: artist_account_id" },
        { status: 400 },
      );
    }

    const result = await processAudioTranscription({
      audioUrl: audio_url,
      ownerAccountId: account_id,
      artistAccountId: artist_account_id,
      title,
      includeTimestamps: include_timestamps,
    });

    return NextResponse.json({
      success: true,
      audioFile: result.audioFile,
      transcriptFile: result.transcriptFile,
      text: result.text,
      language: result.language,
    });
  } catch (error) {
    const { message, status } = formatTranscriptionError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
