import { z } from "zod";

const GLOBAL_SKILL_SOURCE_PATTERN = /^[^\s/]+\/[^\s/]+$/;
const GLOBAL_SKILL_NAME_PATTERN = /^\S+$/;

export const globalSkillRefSchema = z.object({
  source: z
    .string()
    .trim()
    .min(1, "Source is required")
    .regex(GLOBAL_SKILL_SOURCE_PATTERN, "Source must be in owner/repo format"),
  skillName: z
    .string()
    .trim()
    .min(1, "Skill name is required")
    .regex(GLOBAL_SKILL_NAME_PATTERN, "Skill name cannot contain spaces"),
});

export type GlobalSkillRef = z.infer<typeof globalSkillRefSchema>;

function getGlobalSkillRefKey(ref: GlobalSkillRef): string {
  return `${ref.source.toLowerCase()}::${ref.skillName.toLowerCase()}`;
}

export const globalSkillRefsSchema = z.array(globalSkillRefSchema).transform(refs => {
  const seen = new Set<string>();
  const out: GlobalSkillRef[] = [];
  for (const ref of refs) {
    const key = getGlobalSkillRefKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
});

/**
 * Best-effort parse of an arbitrary `global_skill_refs` JSON value into
 * a deduped array of valid refs. Invalid input returns `[]` instead of
 * throwing — caller code can safely combine the result with the
 * platform defaults.
 *
 * @param value - The raw JSON value (typically `row.global_skill_refs`).
 * @returns Validated and deduped refs, or `[]` on any parse failure.
 */
export function normalizeGlobalSkillRefs(value: unknown): GlobalSkillRef[] {
  const parsed = globalSkillRefsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}
