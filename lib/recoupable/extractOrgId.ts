import { extractOrgRepoName } from "@/lib/recoupable/extractOrgRepoName";

const UUID_RAW = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/**
 * Match the trailing UUID either bare (new naming: `<uuid>`) or after
 * a slug + dash (legacy: `<slug>-<uuid>` / `org-<slug>-<uuid>`). Both
 * shapes coexist until the migration script renames every legacy repo
 * — and even after, `sessions.clone_url` rows from before the rename
 * still resolve via GitHub's redirect, so this parser keeps working
 * for old rows forever.
 */
const UUID_TAIL_PATTERN = new RegExp(`(?:^|-)(${UUID_RAW})$`, "i");

/**
 * Extracts the organization UUID from a Recoupable org clone URL or
 * repo name. Recoupable orgs follow the convention `org-<slug>-<uuid-v4>`
 * in their GitHub repo names, so the UUID is always the trailing 36 chars.
 *
 * Used by the chat workflow handler to derive `recoupOrgId` from the
 * session's clone URL — the `recoup-api` skill scopes calls to this org
 * so sandbox agents see results for the sandbox's org rather than every
 * org the user belongs to.
 *
 * @param cloneUrlOrRepoName - Either the full clone URL
 *   (`https://github.com/recoupable/org-foo-<uuid>`) or the already-extracted
 *   repo name (`org-foo-<uuid>`).
 * @returns The lowercased UUID, or `null` for anything that doesn't match.
 */
export function extractOrgId(cloneUrlOrRepoName: string): string | null {
  const repoName = cloneUrlOrRepoName.startsWith("http")
    ? extractOrgRepoName(cloneUrlOrRepoName)
    : cloneUrlOrRepoName;

  if (!repoName) {
    return null;
  }

  const match = repoName.match(UUID_TAIL_PATTERN);
  return match?.[1]?.toLowerCase() ?? null;
}
