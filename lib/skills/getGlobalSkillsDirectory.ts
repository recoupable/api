import * as path from "path";

/**
 * Resolve the absolute path to the global skills directory under a
 * given `$HOME`. This is where `installSessionGlobalSkills` lays down
 * skills at sandbox provisioning time via `npx skills add ... -g`
 * (today: `recoup-api`, `artist-workspace`).
 *
 * @param homeDirectory - The sandbox's resolved $HOME (e.g.
 *   `/home/vercel-sandbox`, or `/root` on the open-agents base image).
 */
export function getGlobalSkillsDirectory(homeDirectory: string): string {
  return path.posix.join(homeDirectory, ".agents", "skills");
}
