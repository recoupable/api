import { RECOUPABLE_GITHUB_OWNER } from "@/lib/recoupable/githubOwner";
import { getServiceGithubToken } from "./getServiceGithubToken";

const LEGACY_SUFFIX_PATTERN = /^.+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Search the `recoupable` org for a legacy-named workspace repo whose
 * name ends with `-<accountId>` — the old `<kebab(name)>-<accountId>`
 * convention. Returns the legacy repo name so `ensurePersonalRepo`
 * can rename it to the new bare-`<accountId>` convention without
 * losing the user's git history.
 *
 * Returns:
 *   - the legacy repo name (e.g. `sweetman-fb678396-...`) on hit
 *   - `null` on miss (no legacy repo exists for this account)
 *   - `undefined` on unexpected failure (caller should treat as miss
 *     and continue with create — losing history is preferable to
 *     blocking provisioning on a flaky GitHub search)
 *
 * Uses GitHub's `GET /search/repositories` endpoint with
 * `<accountId>+in:name+org:recoupable` so we don't have to paginate
 * the entire org.
 *
 * Owner is hard-coded to `recoupable` and the GitHub token is read
 * from the environment (per PR #618 review — single source of truth).
 */
export async function findLegacyAccountRepo(params: {
  accountId: string;
}): Promise<string | null | undefined> {
  const { accountId } = params;

  const token = getServiceGithubToken();
  if (!token) {
    console.error("[findLegacyAccountRepo] GITHUB_TOKEN missing");
    return undefined;
  }

  try {
    const query = encodeURIComponent(`${accountId} in:name org:${RECOUPABLE_GITHUB_OWNER}`);
    const response = await fetch(
      `https://api.github.com/search/repositories?q=${query}&per_page=10`,
      {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!response.ok) {
      console.error(
        `[findLegacyAccountRepo] unexpected status ${response.status} for accountId ${accountId}`,
      );
      return undefined;
    }

    const data = (await response.json()) as {
      items?: Array<{ name: string }>;
    };

    const legacy = (data.items ?? []).find(
      item =>
        item.name !== accountId &&
        item.name.endsWith(`-${accountId}`) &&
        LEGACY_SUFFIX_PATTERN.test(item.name),
    );

    return legacy?.name ?? null;
  } catch (error) {
    console.error("[findLegacyAccountRepo] network error:", error);
    return undefined;
  }
}
