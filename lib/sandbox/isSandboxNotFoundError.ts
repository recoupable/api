/**
 * True when an error message indicates the sandbox VM no longer
 * exists — distinct from generic unavailability. Drives the
 * recover-vs-rebuild decision in `clearUnavailableSandboxState`:
 * not-found means even the resume handle is stale, so the next
 * provision must start from scratch.
 *
 * @param message - The error message string.
 * @returns true when the message matches a known not-found pattern.
 */
export function isSandboxNotFoundError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("status code 404") || normalized.includes("sandbox not found");
}
