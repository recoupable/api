const MAX_OWNER_LENGTH = 39;

/**
 * Returns true if `owner` is a valid GitHub user / org login.
 *
 * GitHub's actual rules: 1–39 characters, alphanumerics and hyphens
 * only, cannot start or end with a hyphen, no consecutive hyphens.
 *
 * @param owner - Candidate owner segment to validate.
 */
export function isValidGitHubRepoOwner(owner: string): boolean {
  if (owner.length === 0 || owner.length > MAX_OWNER_LENGTH) return false;
  if (!/^[a-zA-Z0-9-]+$/.test(owner)) return false;
  if (owner.startsWith("-") || owner.endsWith("-")) return false;
  if (owner.includes("--")) return false;
  return true;
}
