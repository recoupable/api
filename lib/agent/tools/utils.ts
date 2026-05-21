import type { Sandbox } from "@/lib/sandbox/interface";
import type { VercelState } from "@/lib/sandbox/vercel/state";
import { connectVercel } from "@/lib/sandbox/vercel/connect/connectVercel";

/**
 * Per-tool-call context threaded into the agent via `streamText`'s
 * `experimental_context`. Mirrors the open-agents `AgentContext` shape
 * (subset — slim PR 4 only ports `bash`, so context only needs what
 * the bash tool reads).
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
   * Per-prompt access token for the Recoup API. Forwarded to sandboxed
   * commands as `RECOUP_ACCESS_TOKEN` so skills (`recoup-api`) and ad-hoc
   * curls can authenticate as the calling user for the prompt's lifetime.
   */
  recoupAccessToken?: string;
  /**
   * Organization UUID when the sandbox was opened against a recoupable
   * org repo (`org-<slug>-<uuid>`). Forwarded as `RECOUP_ORG_ID` so
   * `recoup-api` skill calls scope to that org.
   */
  recoupOrgId?: string;
};

/**
 * Type-guard that confirms an arbitrary `experimental_context` shape
 * has the AgentContext fields we rely on. Falsy guards on missing
 * fields keep tool error messages precise instead of throwing
 * "cannot read .x of undefined".
 */
export function isAgentContext(value: unknown): value is AgentContext {
  return (
    typeof value === "object" &&
    value !== null &&
    "sandbox" in value &&
    typeof (value as { sandbox: unknown }).sandbox === "object"
  );
}

/**
 * Resolve a connected `Sandbox` instance from `experimental_context`.
 * Reconnects each call via `connectVercel(state)` rather than caching the
 * handle on context — workflow durability requires that side-effecting
 * resources (sandbox sessions) be re-acquired inside the step that uses
 * them, not passed across event boundaries.
 *
 * @param experimental_context - The opaque context object passed by AI SDK to tool execute.
 * @param toolName - Optional tool name to surface in error messages.
 */
export async function getSandbox(
  experimental_context: unknown,
  toolName?: string,
): Promise<Sandbox> {
  const context = isAgentContext(experimental_context) ? experimental_context : undefined;
  if (!context?.sandbox?.state) {
    const where = toolName ? ` (tool: ${toolName})` : "";
    throw new Error(
      `Sandbox state missing from agent context${where}. ` +
        "Ensure the workflow start payload includes `sandbox.state` and that " +
        "runAgentStep threads it via experimental_context.",
    );
  }
  return connectVercel(context.sandbox.state);
}
