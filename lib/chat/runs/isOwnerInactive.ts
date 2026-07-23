/**
 * Age (in days) past which an account's owner is considered inactive — no
 * `role='user'` message in this long means a human likely stopped using the
 * account, yet its scheduled runs keep firing (recoupable/chat#1885).
 */
export const ZOMBIE_OWNER_INACTIVE_DAYS = 45;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pure predicate: is the account owner inactive as of `now`?
 *
 * `null` (the owner has never sent a user message) counts as inactive. A
 * message exactly at the threshold is still considered active — only strictly
 * older than {@link ZOMBIE_OWNER_INACTIVE_DAYS} is stale.
 *
 * @param lastUserMessageAt - ISO timestamp of the owner's most recent
 *   `role='user'` message, or `null` if none exists.
 * @param now - Reference time (injected for deterministic tests).
 */
export function isOwnerInactive(lastUserMessageAt: string | null, now: Date): boolean {
  if (!lastUserMessageAt) return true;

  const ageMs = now.getTime() - new Date(lastUserMessageAt).getTime();
  return ageMs > ZOMBIE_OWNER_INACTIVE_DAYS * DAY_MS;
}
