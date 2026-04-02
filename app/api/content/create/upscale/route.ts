import { createPrimitiveHandler } from "@/lib/content/primitives/handlePrimitiveTrigger";
import { createPrimitiveRoute } from "@/lib/content/primitives/primitiveRoute";
import { createUpscaleBodySchema } from "@/lib/content/primitives/schemas";

/**
 * OPTIONS handler for CORS preflight requests.
 */
const handler = createPrimitiveHandler("create-upscale", createUpscaleBodySchema);
const route = createPrimitiveRoute(handler);
export const OPTIONS = route.OPTIONS;

/**
 * POST /api/content/create/upscale
 *
 * Triggers the create-upscale background task.
 */
export const POST = route.POST;

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
