import type { LanguageModel } from "ai";
import type { VercelState } from "@/lib/sandbox/vercel/state";
import type { SkillMetadata } from "@/lib/skills/skillTypes";

/**
 * Per-tool-call context threaded into the agent via `streamText`'s
 * `experimental_context`. Mirrors the open-agents `AgentContext`
 * interface (`packages/agent/types.ts`) one-for-one. The only
 * deviation is structural: `model` / `subagentModel` are
 * `LanguageModel` instances that cannot ride through a durable
 * Vercel Workflow input, so `runAgentStep` constructs them per-step
 * (via `gateway(input.modelId)`) right before calling `streamText`.
 *
 * The durable workflow-input shape is `DurableAgentContext` below —
 * `runAgentStep` widens that into a full `AgentContext` by attaching
 * the constructed model(s) before `experimental_context` is observed
 * by any tool.
 *
 * `recoupAccessToken` carries a short-lived Privy JWT (~1h TTL) so
 * the `recoup-api` skill can authenticate curl-style calls back to
 * recoup-api as the user. Set by `handleChatWorkflowStream` only when
 * the caller authenticates via `Authorization: Bearer <privy-jwt>` —
 * a long-lived `recoup_sk_…` api key is deliberately NOT forwarded
 * (model-issued bash commands could exfiltrate it via env).
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
   * Short-lived Privy JWT (the user's session token from the chat
   * UI's Privy login). Forwarded into the sandbox env as
   * `RECOUP_ACCESS_TOKEN` so the `recoup-api` skill's curl examples
   * can authenticate as the user. Mirrors open-agents'
   * `AgentContext.recoupAccessToken` (`packages/agent/types.ts:29`).
   *
   * Only set when the chat-workflow caller authenticated via
   * `Authorization: Bearer <jwt>` (or sent `recoupAccessToken` in the
   * request body). x-api-key callers do NOT get the token forwarded —
   * the long-lived `recoup_sk_…` key would be exfiltratable from the
   * sandbox env by any model-issued bash command.
   */
  recoupAccessToken?: string;
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
   * Main agent's language model. Tools read this via `getMainModel`.
   * Set per-step by `runAgentStep` (not part of the durable input).
   * Mirrors open-agents' `AgentContext.model: LanguageModel`.
   */
  model: LanguageModel;
  /**
   * Optional subagent override. If unset, `getSubagentModel` falls
   * back to `model`. Mirrors open-agents'
   * `AgentContext.subagentModel?: LanguageModel`.
   */
  subagentModel?: LanguageModel;
};

/**
 * The JSON-serializable subset of `AgentContext` that survives a
 * Vercel Workflow durable input (`start(runAgentWorkflow, [...])`).
 * `LanguageModel` instances aren't serializable, so they're stripped
 * here and re-attached inside the step.
 */
export type DurableAgentContext = Omit<AgentContext, "model" | "subagentModel">;
