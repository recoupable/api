import { createVideoHandler } from "@/lib/content/primitives/createVideoHandler";
import { editHandler } from "@/lib/content/primitives/editHandler";
import { primitiveOptionsHandler } from "@/lib/content/primitives/createPrimitiveRoute";

export { primitiveOptionsHandler as OPTIONS };

/**
 * POST /api/content/video
 *
 * Generate a video from a prompt, image, or existing video.
 */
export { createVideoHandler as POST };

/**
 * PATCH /api/content/video
 *
 * Edit a video with operations or a template preset.
 */
export { editHandler as PATCH };

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
