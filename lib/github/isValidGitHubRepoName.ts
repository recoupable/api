const GITHUB_REPO_PATH_SEGMENT_PATTERN = /^[.\w-]+$/;

/**
 * Returns true if `repoName` is a valid GitHub repository name segment.
 *
 * @param repoName - Candidate repo name to validate.
 */
export function isValidGitHubRepoName(repoName: string): boolean {
  return GITHUB_REPO_PATH_SEGMENT_PATTERN.test(repoName);
}
