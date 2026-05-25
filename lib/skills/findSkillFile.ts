import * as path from "path";
import type { Sandbox } from "@/lib/sandbox/interface";

/**
 * Locate the SKILL.md file inside a candidate skill directory. Prefers
 * uppercase `SKILL.md` (the project convention) but falls back to
 * lowercase `skill.md` for skills that ship the lowercase name. Returns
 * `null` when neither file exists so callers can skip the entry.
 *
 * Probes via `sandbox.access` (which throws on missing) rather than
 * `readdir` so we don't pay the cost of listing a directory whose
 * contents we don't otherwise need.
 *
 * @param sandbox - Connected sandbox handle.
 * @param skillDir - Absolute path to the candidate skill directory.
 */
export async function findSkillFile(sandbox: Sandbox, skillDir: string): Promise<string | null> {
  const uppercase = path.join(skillDir, "SKILL.md");
  const lowercase = path.join(skillDir, "skill.md");

  try {
    await sandbox.access(uppercase);
    return uppercase;
  } catch {
    // try lowercase
  }
  try {
    await sandbox.access(lowercase);
    return lowercase;
  } catch {
    return null;
  }
}
