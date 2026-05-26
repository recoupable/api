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
 *   1. If the body explicitly provided `cloneUrl`, use it verbatim
 *      (the caller already decided which repo this session targets).
 *   2. Otherwise, ensure a `recoupable/<accountId>` workspace exists
 *      and use that URL. The provisioning is the same for personal
 *      sessions and org-bound sessions because organizations are
 *      themselves accounts (`auth.orgId` IS an account_id — see
 *      `account_organization_ids.organization` joining `accounts`).
 *      When an org is bound, the workspace is keyed on `auth.orgId`;
 *      otherwise on the user's own `auth.accountId`.
 */
export async function resolveSessionCloneUrl(params: {
  bodyCloneUrl: string | undefined;
  auth: AuthContext;
}): Promise<ResolveSessionCloneUrlResult> {
  const { bodyCloneUrl, auth } = params;

  if (bodyCloneUrl) {
    return { ok: true, cloneUrl: bodyCloneUrl };
  }

  const workspaceAccountId = auth.orgId ?? auth.accountId;
  const cloneUrl = await ensurePersonalRepo({
    accountId: workspaceAccountId,
  });

  if (!cloneUrl) {
    return {
      ok: false,
      cloneUrl: null,
      error: "Failed to provision workspace repository",
    };
  }

  return { ok: true, cloneUrl };
}
