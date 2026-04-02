import { createPrimitiveHandler } from "@/lib/content/primitives/handlePrimitiveTrigger";
import { createPrimitiveRoute } from "@/lib/content/primitives/primitiveRoute";
import { createRenderBodySchema } from "@/lib/content/primitives/schemas";

/**
 * OPTIONS handler for CORS preflight requests.
 */
const handler = createPrimitiveHandler("create-render", createRenderBodySchema);
const route = createPrimitiveRoute(handler);
export const OPTIONS = route.OPTIONS;

/**
 * POST /api/content/create/render
 *
 * Triggers the create-render background task.
 */
export const POST = route.POST;

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
