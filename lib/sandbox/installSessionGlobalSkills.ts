import { DEFAULT_GLOBAL_SKILL_REFS } from "@/lib/skills/defaultGlobalSkillRefs";
import { normalizeGlobalSkillRefs } from "@/lib/skills/globalSkillRef";
import { installGlobalSkills } from "@/lib/skills/installGlobalSkills";
import type { Sandbox } from "@/lib/sandbox/interface";
import type { Tables } from "@/types/database.types";

/**
 * Installs the union of platform default skills and the session's
 * configured user skills into the sandbox. Platform defaults are
 * placed first so they win on dedup if a user happens to list the
 * same skill in their preferences. No-op when the combined list is
 * empty (currently impossible since defaults are non-empty, but
 * future-proofed against changing that).
 *
 * @param params.sessionRow - The `sessions` row whose `global_skill_refs` define user-level skills.
 * @param params.sandbox - The connected sandbox handle to install into.
 */
export async function installSessionGlobalSkills(params: {
  sessionRow: Tables<"sessions">;
  sandbox: Sandbox;
}): Promise<void> {
  const userRefs = normalizeGlobalSkillRefs(params.sessionRow.global_skill_refs);
  const refs = [...DEFAULT_GLOBAL_SKILL_REFS, ...userRefs];

  if (refs.length === 0) return;

  await installGlobalSkills({
    sandbox: params.sandbox,
    globalSkillRefs: refs,
  });
}
