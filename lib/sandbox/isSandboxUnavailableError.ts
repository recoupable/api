/**
 * True when an error message indicates the sandbox VM is permanently
 * unreachable — gone, stopped, or returning a hard 4xx that won't
 * recover on retry. Used by reconnect to decide between marking the
 * session `expired` (clear runtime state) vs preserving the runtime
 * state and treating the failure as transient (network blip etc).
 *
 * @param message - The error message string.
 * @returns true when the message matches a known permanent-failure
 *   pattern.
 */
export function isSandboxUnavailableError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("expected a stream of command data") ||
    normalized.includes("status code 410") ||
    normalized.includes("status code 404") ||
    normalized.includes("sandbox is stopped") ||
    normalized.includes("sandbox not found") ||
    normalized.includes("sandbox probe failed")
  );
}
