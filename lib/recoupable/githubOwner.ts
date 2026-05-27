/**
 * The GitHub organization that owns every Recoupable workspace repo,
 * both per-Recoupable-org repos (`recoupable/org-<slug>-<id>`) and
 * per-account personal repos (`recoupable/<slug>-<account_id>`).
 *
 * Single source of truth so renames or alternate-environment overrides
 * stay in lockstep across builders, parsers, and GitHub API callers.
 * Mirrors open-agents `apps/web/lib/recoupable/github-owner.ts` and
 * chat `lib/recoupable/githubOwner.ts` — all three surfaces must
 * agree on this value, otherwise sandboxes try to clone from
 * different orgs depending on which surface created them.
 */
export const RECOUPABLE_GITHUB_OWNER = "recoupable";
