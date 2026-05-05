import type { ModelsDevMetadata } from "@/lib/ai/parseModelsDevMetadata";

interface GatewayModelLike {
  id: string;
}

/**
 * Returns a copy of `model` enriched with `context_window` / `cost`
 * fields when the metadata map has matching values. The original
 * model is never mutated, and missing metadata is a no-op (returns
 * the model unchanged shape-wise) so callers can use this in a map
 * regardless of whether the metadata fetch succeeded.
 *
 * @param model - The gateway model to enrich.
 * @param metadataMap - Result of `fetchModelsDevMetadata`.
 * @returns The enriched model, or the original if no metadata matched.
 */
export function enrichGatewayModel<T extends GatewayModelLike>(
  model: T,
  metadataMap: Map<string, ModelsDevMetadata>,
): T & Partial<ModelsDevMetadata> {
  const meta = metadataMap.get(model.id);
  if (!meta) return model;

  const enriched: T & Partial<ModelsDevMetadata> = { ...model };
  if (meta.context_window !== undefined) enriched.context_window = meta.context_window;
  if (meta.cost !== undefined) enriched.cost = meta.cost;
  return enriched;
}
