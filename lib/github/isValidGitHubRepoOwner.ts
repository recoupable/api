const GITHUB_REPO_PATH_SEGMENT_PATTERN = /^[.\w-]+$/;

/**
 * Returns true if `owner` is a valid GitHub repository owner segment
 * (alphanumerics, underscore, hyphen, dot — the same characters GitHub
 * itself accepts in URL path segments).
 *
 * @param owner - Candidate owner segment to validate.
 */
export function isValidGitHubRepoOwner(owner: string): boolean {
  return GITHUB_REPO_PATH_SEGMENT_PATTERN.test(owner);
}
