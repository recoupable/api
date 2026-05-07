/**
 * Increments a session's lifecycle version for optimistic concurrency
 * control. Returns 1 when the input is null/undefined (e.g. on first
 * sandbox provision after session creation).
 *
 * @param current - The session's current `lifecycle_version`.
 * @returns The next version number to write.
 */
export function getNextLifecycleVersion(current: number | null | undefined): number {
  return (current ?? 0) + 1;
}
