import { createUpscaleHandler } from "@/lib/content/primitives/createUpscaleHandler";
import { createPrimitiveRoute } from "@/lib/content/primitives/createPrimitiveRoute";

/**
 * POST /api/content/upscale
 *
 * Upscale an image or video to higher resolution.
 */
export const { OPTIONS, POST } = createPrimitiveRoute(createUpscaleHandler);

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
