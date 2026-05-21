import type { VercelState } from "@/lib/sandbox/vercel/state";
import type { SkillMetadata } from "@/lib/skills/skillTypes";

/**
 * Per-tool-call context threaded into the agent via `streamText`'s
 * `experimental_context`. Mirrors the open-agents `AgentContext` shape
 * (subset — slim PR 4 ports only the `bash` tool, so context only needs
 * what `bash` reads).
 *
 * Why no `recoupAccessToken` field? A short-lived per-prompt credential
 * would let sandbox tools (`skill`, the eventual `recoup-api` skill) call
 * back to recoup-api as the caller. We deliberately omit it here — the
 * legacy api-key path is too long-lived to expose inside a sandbox where
 * model-issued bash commands can read env. Proper short-lived token
 * minting lands alongside the `skill` tool port.
 */
export type AgentContext = {
  /**
   * Persistable sandbox state. Tools reconnect via `connectVercel(state)` —
   * we never pass a live `Sandbox` instance through context because
   * workflow durability requires replay-friendly inputs.
   */
  sandbox: {
    state: VercelState;
    workingDirectory: string;
    currentBranch?: string;
  };
  /**
   * Organization UUID when the sandbox was opened against a recoupable
   * org repo (`org-<slug>-<uuid>`). Forwarded to sandboxed commands as
   * `RECOUP_ORG_ID` so future `recoup-api` skill calls scope to that org.
   * Public information — no security risk in exposing.
   */
  recoupOrgId?: string;
  /**
   * Skills discovered in the sandbox before workflow start (handler
   * calls `discoverSkills(sandbox, getSandboxSkillDirectories(sandbox))`).
   * The `skillTool` reads this list to:
   *   - resolve names → SKILL.md paths
   *   - filter out skills with `disable-model-invocation`
   *   - surface "Available skills" hints when a model picks an unknown name
   * Empty / undefined when the sandbox has no `skills/` directory.
   */
  skills?: SkillMetadata[];
  /**
   * Model id (e.g. `anthropic/claude-haiku-4.5`) currently driving the
   * main agent loop. Threaded into context so the `task` tool's
   * subagent loop can run against the same model. A separate
   * `subagentModelId` may be added later if/when subagents want to
   * default to a cheaper model than the main agent.
   */
  modelId?: string;
};
