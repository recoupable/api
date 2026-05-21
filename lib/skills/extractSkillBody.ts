/**
 * Strip the YAML frontmatter from a SKILL.md file and return just the
 * markdown body. Returns the entire content (trimmed) when no
 * frontmatter is present.
 *
 * @param fileContent - Full file content read from sandbox.
 */
export function extractSkillBody(fileContent: string): string {
  const match = fileContent.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (match) {
    return fileContent.slice(match[0].length).trim();
  }
  return fileContent.trim();
}
