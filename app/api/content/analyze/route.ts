import { createAnalyzeHandler } from "@/lib/content/primitives/createAnalyzeHandler";
import { createPrimitiveRoute } from "@/lib/content/primitives/createPrimitiveRoute";

/**
 * POST /api/content/analyze
 *
 * Analyze a video and generate text based on its content.
 */
export const { OPTIONS, POST } = createPrimitiveRoute(createAnalyzeHandler);

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
