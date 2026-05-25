/**
 * Shape of the per-model cost catalog used for token-based credit estimation.
 *
 * Mirrors open-agents'
 * `apps/web/lib/models.ts:AvailableModelCost` so the same
 * `estimateModelUsageCost` math runs against either catalog without
 * shape conversion. api's current gateway/models.dev pipeline emits
 * only `{ input, output }` (see
 * `lib/ai/parseModelsDevMetadata.ts:ModelsDevMetadata`); the richer
 * `cache_read` and `context_over_200k` fields are kept in the type so
 * a future catalog expansion (or a hand-edited override) gets picked
 * up automatically by the estimator.
 *
 * All token-cost units are USD per million tokens, matching
 * models.dev.
 */
export interface AvailableModelCostTier {
  input?: number;
  output?: number;
  cache_read?: number;
}

export interface AvailableModelCost extends AvailableModelCostTier {
  context_over_200k?: AvailableModelCostTier;
}
