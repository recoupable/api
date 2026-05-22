/**
 * Replace all occurrences of `$ARGUMENTS` in a skill body with the
 * provided args string (or empty string when no args were passed).
 *
 * Used by `skillTool` after loading SKILL.md so slash-command-style
 * invocations like `/commit -m "fix"` thread the arg suffix through to
 * the skill's body text.
 *
 * @param body - Skill body (markdown after frontmatter).
 * @param args - Optional arguments passed by the model.
 */
export function substituteArguments(body: string, args?: string): string {
  return body.replace(/\$ARGUMENTS/g, args ?? "");
}
