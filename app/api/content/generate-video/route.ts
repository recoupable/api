import { createVideoHandler } from "@/lib/content/primitives/createVideoHandler";
import { createPrimitiveRoute } from "@/lib/content/primitives/createPrimitiveRoute";

/**
 * POST /api/content/generate-video
 *
 * Generate a video from a still image. Supports lipsync mode.
 */
export const { OPTIONS, POST } = createPrimitiveRoute(createVideoHandler);

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
