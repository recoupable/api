import type { Sandbox } from "@/lib/sandbox/interface";
import { resolveSandboxHomeDirectory } from "@/lib/sandbox/resolveSandboxHomeDirectory";
import { getGlobalSkillsDirectory } from "@/lib/skills/getGlobalSkillsDirectory";

/**
 * Resolve the directory list to scan when discovering skills for a
 * sandbox. Currently just one path — `${HOME}/.agents/skills/` —
 * because all skills are provisioned globally at sandbox startup via
 * `installSessionGlobalSkills` rather than bundled into the cloned repo.
 *
 * @param sandbox - Connected sandbox handle.
 */
export async function getSandboxSkillDirectories(sandbox: Sandbox): Promise<string[]> {
  const homeDirectory = await resolveSandboxHomeDirectory(sandbox);
  return [getGlobalSkillsDirectory(homeDirectory)];
}
