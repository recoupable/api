import type { GlobalSkillRef } from "@/lib/skills/globalSkillRef";

/**
 * Skills installed into every session sandbox at create time, regardless
 * of user preferences. Platform-level defaults that the agent should
 * always be able to load on demand — they are descriptor-only at install
 * time, so adding entries here doesn't bloat the system prompt.
 */
export const DEFAULT_GLOBAL_SKILL_REFS: readonly GlobalSkillRef[] = [
  { source: "recoupable/skills", skillName: "recoup-api" },
  { source: "recoupable/skills", skillName: "artist-workspace" },
];
