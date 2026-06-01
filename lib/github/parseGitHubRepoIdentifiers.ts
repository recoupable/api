/**
 * Parses a clone URL into `{ owner, repo }`. Used as a fallback when
 * a session row was created before the api started persisting
 * `repo_owner` / `repo_name` directly — auto-commit needs both to
 * compose the GitHub commit URL and to set the remote auth URL on
 * push. Returns `null` for non-GitHub URLs and for malformed inputs.
 *
 * Recognized shapes:
 *   - `https://github.com/<owner>/<repo>`
 *   - `https://github.com/<owner>/<repo>.git`
 *   - `git@github.com:<owner>/<repo>.git`
 *   - trailing slashes are tolerated
 */
export function parseGitHubRepoIdentifiers(
  cloneUrl: string | null | undefined,
): { owner: string; repo: string } | null {
  if (!cloneUrl) return null;

  // ssh form: git@github.com:owner/repo[.git]
  const sshMatch = cloneUrl.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (sshMatch) {
    return { owner: sshMatch[1]!, repo: sshMatch[2]! };
  }

  // https form: https://github.com/owner/repo[.git][/]
  const httpsMatch = cloneUrl.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (httpsMatch) {
    return { owner: httpsMatch[1]!, repo: httpsMatch[2]! };
  }

  return null;
}
