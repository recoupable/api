import { editHandler } from "@/lib/content/primitives/editHandler";
import { primitiveOptionsHandler } from "@/lib/content/primitives/createPrimitiveRoute";

export { primitiveOptionsHandler as OPTIONS };

/**
 * PATCH /api/content
 *
 * Edit media with operations or a template preset.
 */
export { editHandler as PATCH };

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
