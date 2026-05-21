import * as path from "path";
import type { Sandbox } from "@/lib/sandbox/interface";
import { parseSkillFrontmatter } from "@/lib/skills/parseSkillFrontmatter";
import { frontmatterToOptions, type SkillMetadata } from "@/lib/skills/skillTypes";

/**
 * Built-in commands that skills cannot shadow. Skills with these names
 * would be unreachable via slash command, so we drop them at discovery.
 */
const BUILTIN_COMMANDS = ["model", "resume", "new"];

/**
 * Locate the SKILL.md file inside a candidate skill directory. Prefers
 * uppercase `SKILL.md`, falls back to lowercase `skill.md`, returns null
 * when neither exists.
 */
async function findSkillFile(sandbox: Sandbox, skillDir: string): Promise<string | null> {
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

/**
 * Scan a list of directories for skills. Each directory is expected to
 * contain one subdirectory per skill, with a SKILL.md (or skill.md)
 * inside. Returns metadata for everything discoverable; silently skips
 * non-directories, missing files, malformed frontmatter, and names that
 * shadow built-in slash commands.
 *
 * Dedupes by name (case-insensitive); first-wins across directories so
 * callers can list project skills before global skills and have project
 * shadow global.
 *
 * @param sandbox - Connected sandbox for file ops.
 * @param directories - Absolute paths to scan.
 */
export async function discoverSkills(
  sandbox: Sandbox,
  directories: string[],
): Promise<SkillMetadata[]> {
  const skills: SkillMetadata[] = [];
  const seen = new Set<string>();

  for (const dir of directories) {
    try {
      const stat = await sandbox.stat(dir);
      if (!stat.isDirectory()) continue;
    } catch {
      continue; // directory doesn't exist
    }

    let entries;
    try {
      entries = await sandbox.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = path.join(dir, entry.name);
      const skillFile = await findSkillFile(sandbox, skillDir);
      if (!skillFile) continue;

      let content: string;
      try {
        content = await sandbox.readFile(skillFile, "utf-8");
      } catch {
        continue;
      }

      const parsed = parseSkillFrontmatter(content);
      if (!parsed.success) continue;
      const frontmatter = parsed.data;

      if (BUILTIN_COMMANDS.includes(frontmatter.name.toLowerCase())) {
        console.warn(
          `[discoverSkills] Skipping "${frontmatter.name}" in ${skillDir} — name shadows built-in /${frontmatter.name}`,
        );
        continue;
      }

      const normalized = frontmatter.name.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      skills.push({
        name: frontmatter.name,
        description: frontmatter.description,
        path: skillDir,
        filename: path.basename(skillFile),
        options: frontmatterToOptions(frontmatter),
      });
    }
  }

  return skills;
}
