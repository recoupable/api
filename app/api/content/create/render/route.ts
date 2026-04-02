import { createPrimitiveHandler } from "@/lib/content/primitives/handlePrimitiveTrigger";
import { createPrimitiveRoute, dynamic, fetchCache, revalidate } from "@/lib/content/primitives/primitiveRoute";
import { createRenderBodySchema } from "@/lib/content/primitives/schemas";

const handler = createPrimitiveHandler("create-render", createRenderBodySchema);
export const { OPTIONS, POST } = createPrimitiveRoute(handler);
export { dynamic, fetchCache, revalidate };
