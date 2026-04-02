import { createImageHandler } from "@/lib/content/primitives/createImageHandler";
import { createPrimitiveRoute } from "@/lib/content/primitives/createPrimitiveRoute";

/**
 * POST /api/content/generate-image
 *
 * Generate an AI portrait image from a template and face guide.
 */
export const { OPTIONS, POST } = createPrimitiveRoute(createImageHandler);

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
