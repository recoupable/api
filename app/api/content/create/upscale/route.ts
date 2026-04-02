import { createPrimitiveHandler } from "@/lib/content/primitives/handlePrimitiveTrigger";
import { createPrimitiveRoute, dynamic, fetchCache, revalidate } from "@/lib/content/primitives/primitiveRoute";
import { createUpscaleBodySchema } from "@/lib/content/primitives/schemas";

const handler = createPrimitiveHandler("create-upscale", createUpscaleBodySchema);
export const { OPTIONS, POST } = createPrimitiveRoute(handler);
export { dynamic, fetchCache, revalidate };
