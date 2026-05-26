/**
 * One-time migration: rename every `recoupable/*-<accountId>` workspace
 * repository to the canonical `recoupable/<accountId>` convention.
 *
 *   - Scans all repos under the `recoupable` GitHub org, paginated.
 *   - For each repo whose name matches `^.+-<uuid-v4>$`, extracts the
 *     trailing UUID and renames the repo to just `<uuid>`.
 *   - Skips when the target name already exists (idempotent re-run
 *     safe — first invocation handles the rename, subsequent ones are
 *     no-ops).
 *   - Defaults to dry-run; pass `--apply` to actually perform renames.
 *
 * GitHub auto-redirects the old name for both git clones and the REST
 * API after a rename, so `sessions.clone_url` rows that still
 * reference the old name keep working without any DB backfill.
 *
 * Run via:
 *   pnpm dotenv -e .env.local -- pnpm tsx scripts/migrate-workspace-repo-names.ts
 *   pnpm dotenv -e .env.local -- pnpm tsx scripts/migrate-workspace-repo-names.ts --apply
 *
 * Requires `GITHUB_TOKEN` with `admin:repo` scope on the `recoupable`
 * org in the environment (or `.env.local`).
 *
 * The PATCH-rename request lives inline (rather than as a `lib/github/*`
 * helper) because this script is its only caller — once it runs every
 * legacy repo is renamed and there is no runtime caller to reuse.
 */

import { RECOUPABLE_GITHUB_OWNER } from "@/lib/recoupable/githubOwner";

/**
 * Matches `<slug>-<uuid>` workspace repo names where `<slug>` may be
 * empty — accounts that had no display name at the time the repo was
 * created produced `-<uuid>` (literal leading dash, empty kebab) and
 * must be migrated alongside the populated-slug repos. Bare `<uuid>`
 * names (post-migration) deliberately do NOT match: the required `-`
 * separator before the UUID is absent.
 */
const LEGACY_PATTERN =
  /^(?<slug>.*)-(?<uuid>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

interface OrgRepo {
  name: string;
}

async function listAllOrgRepos(token: string): Promise<OrgRepo[]> {
  const repos: OrgRepo[] = [];
  let page = 1;
  while (true) {
    const response = await fetch(
      `https://api.github.com/orgs/${RECOUPABLE_GITHUB_OWNER}/repos?per_page=100&page=${page}`,
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
      const body = await response.text().catch(() => "");
      throw new Error(`Failed to list org repos at page ${page}: ${response.status} ${body}`);
    }

    const batch = (await response.json()) as OrgRepo[];
    if (batch.length === 0) break;
    repos.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return repos;
}

async function renameRepo(
  from: string,
  to: string,
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${RECOUPABLE_GITHUB_OWNER}/${from}`,
      {
        method: "PATCH",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ name: to }),
      },
    );
    if (response.status === 200) return { ok: true };
    const body = await response.text().catch(() => "");
    return { ok: false, error: `${response.status} ${body}` };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN must be set (admin:repo on recoupable org).");
    process.exit(1);
  }

  console.log(`[migrate] mode=${apply ? "APPLY" : "dry-run"} owner=${RECOUPABLE_GITHUB_OWNER}`);

  const repos = await listAllOrgRepos(token);
  console.log(`[migrate] discovered ${repos.length} repos`);

  const existingNames = new Set(repos.map(r => r.name));

  type Action =
    | { type: "rename"; from: string; to: string }
    | { type: "skip-target-exists"; from: string; to: string }
    | { type: "skip-not-workspace"; name: string };
  const actions: Action[] = [];

  for (const { name } of repos) {
    const match = name.match(LEGACY_PATTERN);
    if (!match?.groups) {
      actions.push({ type: "skip-not-workspace", name });
      continue;
    }
    const uuid = match.groups.uuid.toLowerCase();
    if (existingNames.has(uuid)) {
      actions.push({ type: "skip-target-exists", from: name, to: uuid });
      continue;
    }
    actions.push({ type: "rename", from: name, to: uuid });
  }

  const toRename = actions.filter(
    (a): a is { type: "rename"; from: string; to: string } => a.type === "rename",
  );
  const skipTarget = actions.filter(a => a.type === "skip-target-exists");
  const skipNotWorkspace = actions.filter(a => a.type === "skip-not-workspace");

  console.log(
    `[migrate] plan: rename=${toRename.length}, skip-target-exists=${skipTarget.length}, skip-not-workspace=${skipNotWorkspace.length}`,
  );

  for (const a of toRename) {
    console.log(`  rename: ${a.from} -> ${a.to}`);
  }

  if (!apply) {
    console.log("[migrate] dry-run — no changes made. Re-run with --apply.");
    return;
  }

  let succeeded = 0;
  let failed = 0;
  for (const a of toRename) {
    const result = await renameRepo(a.from, a.to, token);
    if (result.ok) {
      succeeded += 1;
      console.log(`  ok: ${a.from} -> ${a.to}`);
    } else {
      failed += 1;
      console.error(`  fail: ${a.from} -> ${a.to} (${result.error ?? "?"})`);
    }
  }

  console.log(
    `[migrate] done. renamed=${succeeded} failed=${failed} skipped=${skipTarget.length + skipNotWorkspace.length}`,
  );
  if (failed > 0) process.exit(1);
}

void main();
