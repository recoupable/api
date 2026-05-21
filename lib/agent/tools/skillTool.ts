import * as path from "path";
import { tool } from "ai";
import { z } from "zod";
import { getSandbox } from "@/lib/agent/tools/getSandbox";
import { isAgentContext } from "@/lib/agent/tools/isAgentContext";
import { extractSkillBody } from "@/lib/skills/extractSkillBody";
import { injectSkillDirectory } from "@/lib/skills/injectSkillDirectory";
import { substituteArguments } from "@/lib/skills/substituteArguments";
import type { SkillMetadata } from "@/lib/skills/skillTypes";

const skillInputSchema = z.object({
  skill: z.string().describe("The skill name to invoke"),
  args: z.string().optional().describe("Optional arguments for the skill"),
});

function getSkills(experimental_context: unknown): SkillMetadata[] {
  if (!isAgentContext(experimental_context)) return [];
  const ctx = experimental_context as { skills?: SkillMetadata[] };
  return ctx.skills ?? [];
}

/**
 * `skill` — load a project-level skill's SKILL.md body and return it
 * to the model. The model then follows the loaded instructions in
 * subsequent turns (using `bash`, `read`, `write`, etc. to actually
 * carry them out). The skill catalog itself is discovered in the
 * handler before workflow start and threaded via `AgentContext.skills`.
 *
 * Matching is case-insensitive so the model can resolve a slash command
 * like `/Commit` against a skill named `commit`. Skills marked with
 * `disable-model-invocation` in their frontmatter are filtered out at
 * the gate — only the user (via a server-side dispatcher) can run them.
 */
export const skillTool = tool({
  description: `Execute a skill within the main conversation.

When users ask you to perform tasks, check if any of the available skills can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

When users ask you to run a "slash command" or reference "/<something>" (e.g., "/commit", "/review-pr"), they are referring to a skill. Use this tool to invoke the corresponding skill.

How to invoke:
- Use this tool with the skill name and optional arguments
- Examples:
  - skill: "pdf" — invoke the pdf skill
  - skill: "commit", args: "-m 'Fix bug'" — invoke with arguments

Important:
- When a skill is relevant, invoke this tool IMMEDIATELY as your first action
- When the user's message starts with "/<name>", they are invoking a skill — call this tool FIRST before any other tool
- NEVER just announce or mention a skill without actually calling this tool
- Only use skills listed in "Available skills" in your system prompt`,
  inputSchema: skillInputSchema,
  execute: async ({ skill, args }, { experimental_context }) => {
    const sandbox = await getSandbox(experimental_context, "skill");
    const skills = getSkills(experimental_context);

    const normalized = skill.toLowerCase();
    const found = skills.find(s => s.name.toLowerCase() === normalized);
    if (!found) {
      const available = skills.map(s => s.name).join(", ");
      return {
        success: false,
        error: `Skill '${skill}' not found. Available skills: ${available || "none"}`,
      };
    }

    if (found.options.disableModelInvocation) {
      return {
        success: false,
        error: `Skill '${skill}' cannot be invoked by the model (disable-model-invocation is set)`,
      };
    }

    const skillFilePath = path.join(found.path, found.filename);
    let fileContent: string;
    try {
      fileContent = await sandbox.readFile(skillFilePath, "utf-8");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Failed to read skill file: ${message}` };
    }

    const body = extractSkillBody(fileContent);
    const bodyWithDir = injectSkillDirectory(body, found.path);
    const content = substituteArguments(bodyWithDir, args);

    return {
      success: true,
      skillName: skill,
      skillPath: found.path,
      content,
    };
  },
});
