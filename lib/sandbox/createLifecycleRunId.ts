/**
 * Generates a unique identifier for a sandbox-lifecycle workflow run.
 * Format: `lifecycle:<timestamp-ms>:<uuid-v4>` — the timestamp gives
 * humans a quick sanity check of when the run started, the UUID
 * guarantees uniqueness across concurrent kicks.
 *
 * @returns A new run id string.
 */
export function createLifecycleRunId(): string {
  return `lifecycle:${Date.now()}:${crypto.randomUUID()}`;
}
