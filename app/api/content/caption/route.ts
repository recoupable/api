import { createTextHandler } from "@/lib/content/primitives/createTextHandler";
import { createPrimitiveRoute } from "@/lib/content/primitives/createPrimitiveRoute";

/**
 * POST /api/content/caption
 *
 * Generate on-screen caption text for a social video.
 */
export const { OPTIONS, POST } = createPrimitiveRoute(createTextHandler);

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
