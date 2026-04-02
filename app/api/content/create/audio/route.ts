import { createPrimitiveHandler } from "@/lib/content/primitives/handlePrimitiveTrigger";
import { createPrimitiveRoute } from "@/lib/content/primitives/primitiveRoute";
import { createAudioBodySchema } from "@/lib/content/primitives/schemas";

/**
 * OPTIONS handler for CORS preflight requests.
 */
const handler = createPrimitiveHandler("create-audio", createAudioBodySchema);
const route = createPrimitiveRoute(handler);
export const OPTIONS = route.OPTIONS;

/**
 * POST /api/content/create/audio
 *
 * Triggers the create-audio background task.
 */
export const POST = route.POST;

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
