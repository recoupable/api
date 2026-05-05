import { gateway } from "@ai-sdk/gateway";
import isEmbedModel from "./isEmbedModel";
import { enrichGatewayModel } from "@/lib/ai/enrichGatewayModel";
import { fetchModelsDevMetadata } from "@/lib/ai/fetchModelsDevMetadata";

/**
 * Returns the list of available LLMs from the Vercel AI Gateway,
 * enriched with `context_window` and `cost` from the public
 * `models.dev` catalog. The enrichment fetch is best-effort — on
 * any failure the gateway list is returned without enrichment so
 * the endpoint stays available for clients that don't require
 * those fields.
 */
export const getAvailableModels = async () => {
  try {
    const [{ models }, metadataMap] = await Promise.all([
      gateway.getAvailableModels(),
      fetchModelsDevMetadata(),
    ]);
    return models.filter(m => !isEmbedModel(m)).map(m => enrichGatewayModel(m, metadataMap));
  } catch (error) {
    console.error("[getAvailableModels] gateway fetch failed:", error);
    return [];
  }
};
