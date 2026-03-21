import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { generateArtistIntelPackHandler } from "@/lib/artistIntel/generateArtistIntelPackHandler";

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
 * POST /api/artists/intel
 *
 * Generates a complete Artist Intelligence Pack for any artist.
 *
 * Combines three data sources in parallel:
 * 1. Spotify — Artist profile (name, genres, followers, popularity) + top tracks with
 *    30-second audio preview URLs.
 * 2. MusicFlamingo (NVIDIA 8B) — AI audio analysis of the artist's top track via the
 *    Spotify preview URL: genre/BPM/key/mood (catalog_metadata), target audience
 *    demographics (audience_profile), playlist pitch targets (playlist_pitch), and
 *    mood/vibe tags (mood_tags).
 * 3. Perplexity — Real-time web research: recent press, streaming news, and trending
 *    moments for the artist.
 *
 * An AI marketing strategist then synthesizes all three sources into a ready-to-use
 * marketing pack: playlist pitch email, Instagram/TikTok/Twitter captions, press
 * release opener, and key talking points.
 *
 * Request body:
 * - artist_name (required): The artist name to analyze (e.g. "Taylor Swift", "Bad Bunny").
 *
 * @param request - The request object containing a JSON body.
 * @returns A NextResponse with the complete intelligence pack (200) or an error.
 */
export async function POST(request: NextRequest) {
  return generateArtistIntelPackHandler(request);
}
