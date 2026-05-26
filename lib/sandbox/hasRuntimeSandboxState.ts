import { getResumableSandboxName } from "@/lib/sandbox/getResumableSandboxName";
import { getStateExpiresAt } from "@/lib/sandbox/getStateExpiresAt";

/**
 * Returns true when `sandbox_state` carries live runtime metadata —
 * i.e. a sandbox has been provisioned, is not yet expired, and has a
 * resumable name. This mirrors open-agents semantics exactly:
 *
 *   expiresAt defined  →  sandbox was started (not a type-only stub or expired entry)
 *   resumable name     →  sandbox can be operated on
 *
 * `POST /api/sessions` inserts `{ type: "vercel" }` (no expiresAt), so
 * the creation stub correctly returns false.
 *
 * Expired state (sandboxName present but expiresAt absent/stripped) also
 * returns false, preventing the 409 unarchive guard from firing on inert
 * rows and stopping `stopSandboxOnArchive` from attempting to stop an
 * already-gone sandbox.
 *
 * @param state - The persisted `sandbox_state` JSON column value.
 * @returns true when the state describes a live, operable sandbox.
 */
export function hasRuntimeSandboxState(state: unknown): boolean {
  if (!state || typeof state !== "object") return false;
  if (getStateExpiresAt(state) === undefined) return false;
  return getResumableSandboxName(state) !== null;
}
