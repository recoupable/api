import { gateway } from "@ai-sdk/gateway";
import isEmbedModel from "./isEmbedModel";

/**
 * Returns the Vercel AI Gateway model catalog, minus embed models.
 *
 * `@ai-sdk/gateway` is pinned to 2.x because the live `/v1/ai/config`
 * endpoint still emits `specificationVersion: "v2"` descriptors, which
 * the 3.x SDK rejects via a strict Zod literal. Bump to 3.x when the
 * gateway service ships v3-shaped descriptors.
 */
export const getAvailableModels = async () => {
  try {
    const { models } = await gateway.getAvailableModels();
    return models.filter(m => !isEmbedModel(m));
  } catch (error) {
    console.error("[getAvailableModels] gateway fetch failed:", error);
    return [];
  }
};
