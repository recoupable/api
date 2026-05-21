/**
 * Prepend a `Skill directory: <absolute-path>` header to a skill body
 * so the model can construct full paths to scripts and resources living
 * alongside SKILL.md (e.g. `${skillDir}/scripts/check.sh`).
 *
 * @param body - Skill body (after frontmatter strip).
 * @param skillDir - Absolute sandbox path to the skill directory.
 */
export function injectSkillDirectory(body: string, skillDir: string): string {
  return `Skill directory: ${skillDir}\n\n${body}`;
}
