import { skillFrontmatterSchema } from "@/lib/skills/skillTypes";

/**
 * Parse YAML frontmatter from SKILL.md content. Returns the Zod
 * `safeParse` shape so callers can branch cleanly on success.
 *
 * Intentionally a hand-rolled subset of YAML (one-line `key: value`
 * with `"…"` / `'…'` quoting + unquoted `true`/`false`) so we don't
 * pull a YAML dep just to read a 3-line block.
 *
 * @param content - Full SKILL.md content (including the leading `---`).
 */
export function parseSkillFrontmatter(
  content: string,
): ReturnType<typeof skillFrontmatterSchema.safeParse> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match?.[1]) {
    return {
      success: false,
      error: new Error("No frontmatter found") as never,
    };
  }

  const yaml = match[1];
  const parsed: Record<string, unknown> = {};

  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    // Only split on the first colon so values like URLs stay intact.
    let value: string | boolean = trimmed.slice(colonIndex + 1).trim();

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1).replace(/\\'/g, "'");
    } else if (value === "true") {
      value = true;
    } else if (value === "false") {
      value = false;
    }

    parsed[key] = value;
  }

  return skillFrontmatterSchema.safeParse(parsed);
}
