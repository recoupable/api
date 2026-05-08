import { resolveSandboxHomeDirectory } from "@/lib/sandbox/resolveSandboxHomeDirectory";
import { shellEscape } from "@/lib/sandbox/shellEscape";
import { globalSkillRefsSchema, type GlobalSkillRef } from "@/lib/skills/globalSkillRef";
import type { Sandbox } from "@/lib/sandbox/interface";

const GLOBAL_SKILLS_INSTALL_TIMEOUT_MS = 120_000;

/**
 * Installs the supplied skill refs into the sandbox by running
 * `npx skills add ...` for each one. Refs are validated and deduped
 * via `globalSkillRefsSchema` before any command runs. Throws on the
 * first failure — caller is expected to handle the error
 * (typically best-effort: log and continue).
 *
 * @param params.sandbox - The connected sandbox handle.
 * @param params.globalSkillRefs - Refs to install (defaults + user prefs).
 */
export async function installGlobalSkills(params: {
  sandbox: Sandbox;
  globalSkillRefs: GlobalSkillRef[];
}): Promise<void> {
  const refs = globalSkillRefsSchema.parse(params.globalSkillRefs);
  if (refs.length === 0) return;

  const homeDirectory = await resolveSandboxHomeDirectory(params.sandbox);

  for (const ref of refs) {
    const result = await params.sandbox.exec(
      `HOME=${shellEscape(homeDirectory)} npx skills add ${shellEscape(ref.source)} --skill ${shellEscape(ref.skillName)} --agent amp -g -y --copy`,
      params.sandbox.workingDirectory,
      GLOBAL_SKILLS_INSTALL_TIMEOUT_MS,
    );

    if (!result.success) {
      throw new Error(
        `Failed to install global skill ${ref.skillName} from ${ref.source}: ${result.stderr || result.stdout || "unknown error"}`,
      );
    }
  }
}
