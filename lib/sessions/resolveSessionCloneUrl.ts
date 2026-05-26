import { ensurePersonalRepo } from "@/lib/recoupable/ensurePersonalRepo";
import type { AuthContext } from "@/lib/auth/validateAuthContext";

/**
 * Flat shape (not a discriminated union) — Next.js 16's `next build`
 * doesn't narrow `{ ok: true; cloneUrl } | { ok: false; error }`
 * through `if (!result.ok)` cleanly, so we make `error` optional and
 * the caller checks `ok` plus reads `error` directly.
 */
export interface ResolveSessionCloneUrlResult {
  ok: boolean;
  cloneUrl: string | null;
  error?: string;
}

/**
 * Determine the final `clone_url` for a new session row.
 *
 *   1. If the body explicitly provided `cloneUrl`, use it. Both chat
 *      (active-org case) and sandbox.recoupable.com construct the org
 *      URL client-side and send it through.
 *   2. If the body omitted `cloneUrl` AND the caller has no `orgId`
 *      bound to their auth context, treat this as a personal session
 *      and call `ensurePersonalRepo` so the account's
 *      `recoupable/<accountId>` repo exists (with a legacy-rename
 *      step for accounts that had `<slug>-<accountId>` workspaces
 *      under the old naming convention) before `POST /api/sandbox`
 *      tries to clone it.
 *   3. Otherwise (no `cloneUrl`, but an org is bound), return `null`
 *      so the session row stores no `clone_url`. Org-repo URL
 *      derivation stays a client-side concern for now to keep this PR
 *      focused on personal-repo provisioning.
 */
export async function resolveSessionCloneUrl(params: {
  bodyCloneUrl: string | undefined;
  auth: AuthContext;
}): Promise<ResolveSessionCloneUrlResult> {
  const { bodyCloneUrl, auth } = params;

  if (bodyCloneUrl) {
    return { ok: true, cloneUrl: bodyCloneUrl };
  }

  if (auth.orgId) {
    return { ok: true, cloneUrl: null };
  }

  const cloneUrl = await ensurePersonalRepo({ accountId: auth.accountId });

  if (!cloneUrl) {
    return {
      ok: false,
      cloneUrl: null,
      error: "Failed to provision personal repository",
    };
  }

  return { ok: true, cloneUrl };
}
