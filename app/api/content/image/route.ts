import { createImageHandler } from "@/lib/content/primitives/createImageHandler";
import { createPrimitiveRoute } from "@/lib/content/primitives/createPrimitiveRoute";

/**
 * POST /api/content/image
 *
 * Generate an image from a prompt and optional reference image.
 */
export const { OPTIONS, POST } = createPrimitiveRoute(createImageHandler);

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
