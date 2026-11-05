import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postFlamingoGenerateBatchHandler } from "@/lib/flamingo/postFlamingoGenerateBatchHandler";

/**
 * Prompts run one after another on one model container, so a large batch can
 * outlast the default function duration. Kept above the Modal endpoint's
 * 600 s timeout so the API never abandons a batch the model finishes.
 */
export const maxDuration = 800;

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
 * POST /api/songs/analyze/batch
 *
 * Ask many short questions about one audio file in a single model call.
 * The audio is downloaded (and transcoded if needed) once, then every prompt
 * runs as its own conversation against it. The per-call base price is paid
 * once for the whole batch instead of once per prompt.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Request body:
 * - audio_url (required): Public URL to an audio file
 * - prompts (required): 1–40 items of `{ id, prompt, max_new_tokens? }`
 *   - id: Caller's key for the answer (1–64 characters, unique in the batch)
 *   - prompt: The question (1–4,000 characters)
 *   - max_new_tokens (optional): Max tokens for this answer (1–2048, default 400)
 * - temperature (optional): Controls creativity (0–2, default 0.2)
 * - top_p (optional): Nucleus sampling cutoff (0–1, default 1)
 * - do_sample (optional): Enable sampling (default false)
 *
 * Pricing: one base price plus the batch's total seconds; the balance must
 * hold one base price before the model runs (402 otherwise).
 *
 * Response (200):
 * - status: "success"
 * - answers: Array of `{ id, response, elapsed_seconds }`, one per prompt
 * - elapsed_seconds: Total time for the batch, in seconds
 * - prompts: How many prompts were answered
 *
 * Errors: 400 invalid body, 401 unauthenticated, 402 insufficient credits,
 * 422 audio_url not reachable or not audio, 502 model service rejected the
 * batch (`upstream_status`, `detail`), 500 anything else.
 *
 * @param request - The request object containing the JSON body
 * @returns A NextResponse with every prompt's answer or an error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return postFlamingoGenerateBatchHandler(request);
}
