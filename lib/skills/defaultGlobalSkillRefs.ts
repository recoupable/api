import type { GlobalSkillRef } from "@/lib/skills/globalSkillRef";

/**
 * Skills installed into every session sandbox at create time, regardless
 * of user preferences. Platform-level defaults that the agent should
 * always be able to load on demand — they are descriptor-only at install
 * time, so adding entries here doesn't bloat the system prompt.
 *
 * Names must match the current `recoupable/skills` slugs exactly —
 * `installGlobalSkills` runs `npx skills add … --skill <name>`, which
 * throws on an unknown name (recoupable/chat#1815). The legacy `recoup-api`
 * + `artist-workspace` skills were renamed/split into the entries below.
 */
export const DEFAULT_GLOBAL_SKILL_REFS: readonly GlobalSkillRef[] = [
  // API access + live data + send-email (was `recoup-api`).
  { source: "recoupable/skills", skillName: "recoup-platform-api-access" },
  // Reliable email send (Node helper) — pairs with the api-access skill.
  { source: "recoupable/skills", skillName: "recoup-platform-email-helper" },
  // Folder-tree / RECOUP.md scaffolding + roster ops (was `artist-workspace`).
  { source: "recoupable/skills", skillName: "recoup-platform-build-workspace" },
  { source: "recoupable/skills", skillName: "recoup-roster-add-artist" },
  { source: "recoupable/skills", skillName: "recoup-roster-list-artists" },
  { source: "recoupable/skills", skillName: "recoup-roster-manage-artist" },
];
