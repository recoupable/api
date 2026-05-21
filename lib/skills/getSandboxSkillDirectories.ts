import type { Sandbox } from "@/lib/sandbox/interface";

/**
 * Resolve the list of directories to scan when discovering skills for a
 * given sandbox. Slim PR 6 ships project-level skills only — global
 * skills (the ones `installSessionGlobalSkills` lays down under
 * `~/.skills`) become a follow-up alongside short-lived token minting,
 * since the highest-value global skill (recoup-api) needs that token to
 * be useful.
 *
 * @param sandbox - Connected sandbox; we only read `workingDirectory`.
 */
export function getSandboxSkillDirectories(sandbox: Sandbox): string[] {
  return [`${sandbox.workingDirectory}/skills`];
}
