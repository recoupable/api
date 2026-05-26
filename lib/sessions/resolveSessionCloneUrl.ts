import { getAccountWithDetails } from "@/lib/supabase/accounts/getAccountWithDetails";
import { ensurePersonalRepo } from "@/lib/recoupable/ensurePersonalRepo";
import type { AuthContext } from "@/lib/auth/validateAuthContext";

export type ResolveSessionCloneUrlResult =
  | { ok: true; cloneUrl: string | null }
  | { ok: false; error: string };

/**
 * Determines the final `clone_url` for a new session row.
 *
 *   1. If the body explicitly provided `cloneUrl`, use it. Both chat
 *      (active-org case) and sandbox.recoupable.com construct the org
 *      URL client-side and send it through.
 *   2. If the body omitted `cloneUrl` AND the caller has no `orgId`
 *      bound to their auth context, treat this as a personal session
 *      and call `ensurePersonalRepo` so a brand-new user gets a fresh
 *      `recoupable/<kebab(name)>-<account_id>` repo provisioned before
 *      `POST /api/sandbox` tries to clone it (Path C cutover for
 *      chat.recoupable.com — recoupable/chat#1747).
 *   3. Otherwise (no `cloneUrl`, but an org is bound), return `null`
 *      so the session row stores no `clone_url` and the sandbox falls
 *      back to whatever existing behavior handles that case. This
 *      branch is intentionally narrow — org-repo URL derivation
 *      stays a client-side concern for now to keep this PR focused
 *      on personal-repo provisioning.
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

  const account = await getAccountWithDetails(auth.accountId);
  if (!account) {
    return {
      ok: false,
      error: "Account not found for personal-session provisioning",
    };
  }

  const accountName = resolvePersonalRepoAccountName(account);
  if (!accountName) {
    return {
      ok: false,
      error: "Account has no name or email to derive a personal repo identifier from",
    };
  }

  const ensured = await ensurePersonalRepo({
    accountName,
    accountId: auth.accountId,
  });

  if (!ensured) {
    return { ok: false, error: "Failed to provision personal repository" };
  }

  return { ok: true, cloneUrl: ensured.cloneUrl };
}

interface PersonalRepoAccountFields {
  name?: string | null;
  email?: string | null;
}

/**
 * Pick the most stable string to kebab into the personal repo slug.
 * Prefers `account_info.name`; falls back to the local-part of the
 * account's email (matches open-agents `fetchOrCreateAccount`
 * fallback). Returns `null` when neither is usable so callers can
 * surface a clean error rather than building a slug like `-<id>`.
 */
function resolvePersonalRepoAccountName(account: PersonalRepoAccountFields): string | null {
  const trimmedName = account.name?.trim();
  if (trimmedName) return trimmedName;

  const trimmedEmail = account.email?.trim();
  if (trimmedEmail) {
    const localPart = trimmedEmail.split("@")[0];
    if (localPart && localPart.length > 0) return localPart;
  }

  return null;
}
