import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postSongMomentsHandler } from "@/lib/songMoments/postSongMomentsHandler";

/** A cold measurement container plus cold model containers can take a few minutes. */
export const maxDuration = 300;

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * POST /api/songs/moments
 *
 * Finds a song's sections and its best short moments for licensing and
 * editing. Times come from measuring the audio (beat grid, loudness, which
 * passages repeat), not from a language model; Music Flamingo then listens to
 * each moment's clip and describes it.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Request body:
 * - audio_url (required): Public URL to an audio file (MP3, WAV, FLAC)
 * - section_order (optional): The song's section headers in order, as a lyric
 *   sheet lists them ("Verse 1", "Pre-Chorus", "Chorus"...). Names the sections.
 * - describe (optional): true (default) to describe every moment, false for
 *   none, or a list of moment types to describe.
 *
 * Response (200):
 * - status: "success"
 * - measured_with: the measurement version, for rerunning stored results
 * - duration_seconds, tempo_bpm, loudness_lufs, ending ("fade" | "cold")
 * - names_from: "lyrics" when section_order fit the audio, else "audio"
 * - sections: [{ label, start, end, group, energy }]
 * - moments: [{ type, start, end, section, energy, cuts: { "6", "15", "30" },
 *   also?, description?, emotion?, best_for?, vocals? }]
 * - energy_curve: loudness per second, 0–100
 * - elapsed_seconds
 *
 * Pricing: $0.01 per song measured, plus the /api/songs/analyze rate for each
 * moment described.
 *
 * @param request - The request object containing the JSON body
 * @returns A NextResponse with the song's moments or an error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return postSongMomentsHandler(request);
}
