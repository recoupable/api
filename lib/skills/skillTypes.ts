import { z } from "zod";

/**
 * Zod schema for skill frontmatter YAML validation. Defines the
 * expected structure at the top of SKILL.md files.
 */
export const skillFrontmatterSchema = z.object({
  name: z.string().min(1, "Skill name cannot be empty").describe("Unique name of the skill"),
  description: z
    .string()
    .min(1, "Skill description cannot be empty")
    .describe("Short description for the agent"),
  version: z.string().optional().describe("Skill version"),
  "disable-model-invocation": z
    .boolean()
    .optional()
    .describe("If true, the model cannot invoke this skill automatically"),
  "user-invocable": z
    .boolean()
    .optional()
    .describe("If false, users cannot invoke this skill via slash command"),
  "allowed-tools": z
    .string()
    .optional()
    .describe("Comma-separated list of allowed tools when skill is active"),
  context: z.enum(["fork"]).optional().describe("Execution context for the skill"),
  agent: z.string().optional().describe("Agent type to use for execution"),
});

export type SkillFrontmatter = z.infer<typeof skillFrontmatterSchema>;

/**
 * Normalized skill options derived from frontmatter — camelCase fields,
 * comma-separated lists pre-split.
 */
export interface SkillOptions {
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
  allowedTools?: string[];
  context?: "fork";
  agent?: string;
}

/**
 * Skill metadata stored on `AgentContext.skills`. Contains only what
 * `skillTool` needs at invocation time — the SKILL.md body is loaded
 * lazily.
 */
export interface SkillMetadata {
  /** Unique name of the skill. */
  name: string;
  /** Short description for the agent. */
  description: string;
  /** Absolute sandbox path to the skill directory. */
  path: string;
  /** Filename of the skill file (`SKILL.md` or `skill.md`). */
  filename: string;
  /** Skill options from frontmatter. */
  options: SkillOptions;
}

/**
 * Normalize parsed frontmatter to {@link SkillOptions}.
 */
export function frontmatterToOptions(frontmatter: SkillFrontmatter): SkillOptions {
  return {
    disableModelInvocation: frontmatter["disable-model-invocation"],
    userInvocable: frontmatter["user-invocable"],
    allowedTools: frontmatter["allowed-tools"]
      ?.split(",")
      .map(t => t.trim())
      .filter(Boolean),
    context: frontmatter.context,
    agent: frontmatter.agent,
  };
}
