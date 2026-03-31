import { NextRequest, NextResponse } from "next/server";
import { processAudioTranscription } from "@/lib/transcribe/processAudioTranscription";
import { formatTranscriptionError } from "@/lib/transcribe/types";

/**
 * POST /api/transcribe
 *
 * Fetches an audio file from the provided URL, transcribes it using OpenAI Whisper,
 * and saves both the audio and transcript as file records linked to the artist account.
 *
 * @param req - The incoming request containing audio_url, account_id, artist_account_id, title, and include_timestamps
 * @returns A NextResponse with the created audio file record, transcript file record, and transcription text
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
