import * as path from "path";
import type { Sandbox } from "@/lib/sandbox/interface";
import { resolveSandboxHomeDirectory } from "@/lib/sandbox/resolveSandboxHomeDirectory";

/**
 * Global skill directory under `$HOME`. This is where
 * `installSessionGlobalSkills` lays down skills at sandbox provisioning
 * time via `npx skills add ... -g`. Per project convention all skills
 * are provisioned globally — org repos do not bundle their own skill
 * directories, so there's nothing project-level to scan.
 */
export function getGlobalSkillsDirectory(homeDirectory: string): string {
  return path.posix.join(homeDirectory, ".agents", "skills");
}

/**
 * Resolve the directory list to scan when discovering skills for a
 * sandbox. Currently just one path — `${HOME}/.agents/skills/` —
 * because skills are always provisioned globally at sandbox startup
 * rather than bundled into the cloned repo.
 *
 * @param sandbox - Connected sandbox handle.
 */
export async function getSandboxSkillDirectories(sandbox: Sandbox): Promise<string[]> {
  const homeDirectory = await resolveSandboxHomeDirectory(sandbox);
  return [getGlobalSkillsDirectory(homeDirectory)];
}
