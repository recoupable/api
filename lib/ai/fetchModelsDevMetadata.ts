import { parseModelsDevMetadata } from "@/lib/ai/parseModelsDevMetadata";
import type { ModelsDevMetadata } from "@/lib/ai/parseModelsDevMetadata";

const MODELS_DEV_URL = "https://models.dev/api.json";
const TIMEOUT_MS = 750;

/**
 * Fetches the public `models.dev` catalog and returns parsed enrichment
 * metadata. Treats every failure mode (timeout, non-2xx, malformed JSON,
 * thrown error) as "no metadata" and returns an empty map — never
 * propagates the error, since enrichment is best-effort and must not
 * gate the underlying gateway-models response.
 *
 * @returns Map keyed by `provider/model`, possibly empty.
 */
export async function fetchModelsDevMetadata(): Promise<Map<string, ModelsDevMetadata>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(MODELS_DEV_URL, { signal: controller.signal });
    if (!response.ok) return new Map();
    const data: unknown = await response.json();
    return parseModelsDevMetadata(data);
  } catch {
    return new Map();
  } finally {
    clearTimeout(timeoutId);
  }
}
