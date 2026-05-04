const MAX_REPO_NAME_LENGTH = 100;

/**
 * Returns true if `repoName` is a valid GitHub repository name.
 *
 * GitHub's actual rules: 1–100 characters, alphanumerics plus `.`,
 * `-`, and `_`. The reserved names `.` and `..` are not allowed,
 * and a name cannot end with `.git`.
 *
 * @param repoName - Candidate repo name to validate.
 */
export function isValidGitHubRepoName(repoName: string): boolean {
  if (repoName.length === 0 || repoName.length > MAX_REPO_NAME_LENGTH) return false;
  if (repoName === "." || repoName === "..") return false;
  if (!/^[\w.-]+$/.test(repoName)) return false;
  if (repoName.toLowerCase().endsWith(".git")) return false;
  return true;
}
