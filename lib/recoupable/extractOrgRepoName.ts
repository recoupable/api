const ORG_REPO_URL_PATTERN = /^https:\/\/github\.com\/recoupable\/([^/]+?)(?:\.git)?\/?$/;

/**
 * Extracts the repo name from a Recoupable org clone URL. The repo
 * name is used as a `sandboxName` to look up per-org base snapshots
 * built by the build-org-snapshot workflow — finding one warm-boots
 * the sandbox in seconds instead of paying the ~75s full-clone path.
 *
 * Example: `https://github.com/recoupable/org-rostrum-pacific-<uuid>`
 *   → `org-rostrum-pacific-<uuid>`
 *
 * @param cloneUrl - The repo URL the caller wants to clone.
 * @returns The repo name when the URL is under the recoupable org,
 *   otherwise null. Non-recoupable repos skip the snapshot lookup.
 */
export function extractOrgRepoName(cloneUrl: string): string | null {
  const match = cloneUrl.match(ORG_REPO_URL_PATTERN);
  return match?.[1] ?? null;
}
