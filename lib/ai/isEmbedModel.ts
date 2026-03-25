import { GatewayLanguageModelEntry } from "@ai-sdk/gateway";

/**
 * Determines if a model is an embedding model (not suitable for chat).
 * Embed models typically have 0 output pricing since they only produce embeddings.
 *
 * @param m
 */
export const isEmbedModel = (m: GatewayLanguageModelEntry): boolean => {
  const pricing = m.pricing;
  if (!pricing) return false;
  const output = parseFloat(pricing.output);
  return output === 0;
};

export default isEmbedModel;
