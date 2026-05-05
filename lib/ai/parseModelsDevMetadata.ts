export interface ModelsDevMetadata {
  context_window?: number;
  cost?: { input: number; output: number };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parses a `models.dev` API.json payload into a map of model-id → enrichment
 * metadata (context window + per-million-token cost). Tolerant of malformed
 * input — anything that doesn't fit the expected shape is skipped silently
 * so a third-party catalog change can never crash the gateway proxy.
 *
 * @param data - Raw payload from https://models.dev/api.json.
 * @returns Map keyed by fully-qualified model id (`provider/model`).
 */
export function parseModelsDevMetadata(data: unknown): Map<string, ModelsDevMetadata> {
  const map = new Map<string, ModelsDevMetadata>();
  if (!isRecord(data)) return map;

  for (const [providerKey, providerValue] of Object.entries(data)) {
    if (!isRecord(providerValue)) continue;
    if (!isRecord(providerValue.models)) continue;

    for (const [modelKey, modelValue] of Object.entries(providerValue.models)) {
      if (!isRecord(modelValue)) continue;

      const rawId = typeof modelValue.id === "string" ? modelValue.id : modelKey;
      const modelId = rawId.includes("/") ? rawId : `${providerKey}/${rawId}`;

      const meta: ModelsDevMetadata = {};

      if (
        isRecord(modelValue.limit) &&
        typeof modelValue.limit.context === "number" &&
        modelValue.limit.context > 0
      ) {
        meta.context_window = modelValue.limit.context;
      }

      if (
        isRecord(modelValue.cost) &&
        typeof modelValue.cost.input === "number" &&
        typeof modelValue.cost.output === "number"
      ) {
        meta.cost = { input: modelValue.cost.input, output: modelValue.cost.output };
      }

      if (meta.context_window !== undefined || meta.cost !== undefined) {
        map.set(modelId, meta);
      }
    }
  }

  return map;
}
