export const ROUTING_MODELS = {
  fast: "google/gemini-3.5-flash-lite",
  balanced: "moonshotai/kimi-k3",
  frontier: "openai/gpt-6-astra",
} as const;

export type RoutingTier = keyof typeof ROUTING_MODELS;

/** Choose the execution tier; uncertainty favors capability over price. */
export function resolveRoutingTier(tier: RoutingTier, confidence: number): RoutingTier {
  // Policy tuning point: raise this threshold to favor quality over cost.
  return confidence < 0.7 ? "frontier" : tier;
}
