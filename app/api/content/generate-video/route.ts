import { createVideoHandler } from "@/lib/content/primitives/createVideoHandler";
import { createPrimitiveRoute } from "@/lib/content/primitives/createPrimitiveRoute";

/**
 * POST /api/content/generate-video
 *
 * Generate a video. Optionally provide a reference image and/or audio.
 */
export const { OPTIONS, POST } = createPrimitiveRoute(createVideoHandler);

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
