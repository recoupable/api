import { createAudioHandler } from "@/lib/content/primitives/createAudioHandler";
import { createPrimitiveRoute } from "@/lib/content/primitives/createPrimitiveRoute";

/**
 * POST /api/content/transcribe-audio
 *
 * Transcribe a song into timestamped lyrics.
 */
export const { OPTIONS, POST } = createPrimitiveRoute(createAudioHandler);

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
