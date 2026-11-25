import { z } from "zod";

export const recoupSkillsToolSchema = z
  .object({
    query: z
      .string()
      .trim()
      .max(200)
      .optional()
      .describe("Topic or words to find in skill names and descriptions"),
    offset: z.number().int().min(0).optional().describe("Next offset from a previous search"),
    skill: z
      .string()
      .regex(/^[a-z0-9-]{1,64}$/)
      .optional()
      .describe("Exact skill name to load"),
    file: z
      .string()
      .min(1)
      .max(1024)
      .optional()
      .describe("Skill-relative supporting file. Defaults to SKILL.md when a skill is selected"),
  })
  .strict()
  .refine(
    ({ file, offset, query, skill }) =>
      skill ? query === undefined && offset === undefined : file === undefined,
    "Provide a skill and optional file, or list skills with an optional query and offset.",
  );
