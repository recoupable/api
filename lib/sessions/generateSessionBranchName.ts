/**
 * Generates a fresh branch name for a session that opted in to
 * `isNewBranch`. Format: `ag/<8-hex-chars>` — the `ag` prefix marks
 * agent-authored branches and the suffix is random enough to avoid
 * collisions across concurrent sessions.
 */
export function generateSessionBranchName(): string {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `ag/${suffix}`;
}
