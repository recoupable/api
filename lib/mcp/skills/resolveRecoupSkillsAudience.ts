import type { McpAuthInfo } from "../verifyApiKey";
import { hasRecoupStaffSkills } from "./hasRecoupStaffSkills";

/** Resolve the account and optional tool budget before loading a catalog. */
export async function resolveRecoupSkillsAudience(
  authInfo: McpAuthInfo | undefined,
): Promise<"all" | "public" | undefined> {
  if (authInfo?.extra.oauth?.selectedContext) return undefined;
  const { resolveAccountId } = await import("../resolveAccountId");
  const { accountId } = await resolveAccountId({ authInfo, accountIdOverride: undefined });
  if (!accountId) return undefined;

  // Legacy-only environments do not provision the OAuth-backed rate limiter.
  const limiterConfigured = process.env.OAUTH_ISSUER && process.env.OAUTH_INDEX_KEY;
  if (authInfo?.extra.oauth || limiterConfigured) {
    const { checkFullOAuthRateLimit } = await import("../oauth/checkFullOAuthRateLimit");
    await checkFullOAuthRateLimit("recoup_skills", accountId);
  }
  return (await hasRecoupStaffSkills(accountId, authInfo)) ? "all" : "public";
}
