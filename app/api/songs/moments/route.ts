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
 * - tempo_hint (optional): Tempo in BPM (30–300) from metadata; the beat
 *   tracker's reading is reconciled to it when a half/double/3:4 multiple fits.
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
 * - lufs (same as loudness_lufs), true_peak_dbtp, sample_peak_dbfs,
 *   crest_factor_db, loudness_range_lu, broadcast_ready
 * - stereo: { lr_correlation, side_to_mid }, spectral_centroid_hz, rolloff95_hz
 * - band_profile: seven bands, each { band, lo_hz, hi_hz, share_pct, side_pct,
 *   level_pct, status }
 * - fingerprint: six 0–1 axes, with fingerprint_inputs
 * - key: { tonic, mode, confidence }, time_signature, valence, arousal
 * - mute_drops: [{ type: "mute" | "breakdown", start, end, beats, depth_db, mmss }]
 * - chord_loop: { dominant_loop, loop_share, distinct_chords, bars, confidence: "low" }
 * - edit_points: [{ type: "in" | "out", time, name, note, mmss }]
 * - tempo_note: how tempo_bpm was decided
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
