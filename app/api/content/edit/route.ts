import { editHandler } from "@/lib/content/primitives/editHandler";
import { createPrimitiveRoute } from "@/lib/content/primitives/createPrimitiveRoute";

/**
 * POST /api/content/edit
 *
 * Edit media with an operations pipeline or a template preset.
 */
export const { OPTIONS, POST } = createPrimitiveRoute(editHandler);

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
