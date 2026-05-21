import * as path from "path";
import type { Sandbox } from "@/lib/sandbox/interface";
import { resolveSandboxHomeDirectory } from "@/lib/sandbox/resolveSandboxHomeDirectory";

const PROJECT_SKILL_BASE_FOLDERS = [".claude", ".agents"];

/**
 * Project-level skill directories inside the cloned repo. Matches the
 * paths the `recoupable/skills` CLI writes to when called locally
 * (e.g. `npx skills add ... --agent claude` → `.claude/skills/`).
 */
export function getProjectSkillDirectories(workingDirectory: string): string[] {
  return PROJECT_SKILL_BASE_FOLDERS.map(folder =>
    path.posix.join(workingDirectory, folder, "skills"),
  );
}

/**
 * Global skill directory under `$HOME`. This is where
 * `installSessionGlobalSkills` lays down the default global skills
 * (`recoup-api`, `artist-workspace`) at sandbox provisioning time via
 * `npx skills add ... -g`.
 */
export function getGlobalSkillsDirectory(homeDirectory: string): string {
  return path.posix.join(homeDirectory, ".agents", "skills");
}

/**
 * Resolve the list of directories to scan when discovering skills for a
 * sandbox. Mirrors the open-agents three-path layout:
 *
 *   - `${workingDirectory}/.claude/skills/`
 *   - `${workingDirectory}/.agents/skills/`
 *   - `${HOME}/.agents/skills/` (global; populated at provisioning)
 *
 * Probes the sandbox's `$HOME` via `resolveSandboxHomeDirectory` so the
 * global directory matches the sandbox's actual user (defaults to
 * `/root` in the open-agents / recoupable base image).
 *
 * @param sandbox - Connected sandbox handle.
 */
export async function getSandboxSkillDirectories(sandbox: Sandbox): Promise<string[]> {
  const homeDirectory = await resolveSandboxHomeDirectory(sandbox);
  return [
    ...getProjectSkillDirectories(sandbox.workingDirectory),
    getGlobalSkillsDirectory(homeDirectory),
  ];
}
