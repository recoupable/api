import { createPrimitiveHandler } from "@/lib/content/primitives/handlePrimitiveTrigger";
import { createPrimitiveRoute } from "@/lib/content/primitives/primitiveRoute";
import { createVideoBodySchema } from "@/lib/content/primitives/schemas";

const handler = createPrimitiveHandler("create-video", createVideoBodySchema);
export const { OPTIONS, POST } = createPrimitiveRoute(handler);

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
